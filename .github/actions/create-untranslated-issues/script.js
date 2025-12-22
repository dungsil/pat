const fs = require('fs');
const path = require('path');

module.exports = async ({ github, context, core, inputs }) => {
  const { game, filePath } = inputs;
  const absoluteFilePath = path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absoluteFilePath)) {
    console.log('번역되지 않은 항목이 없습니다 (파일 없음).');
    return;
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(absoluteFilePath, 'utf-8'));
  } catch (e) {
    console.error('JSON 파싱 오류:', e);
    return;
  }

  if (!data.items || data.items.length === 0) {
    console.log('번역되지 않은 항목이 없습니다 (항목 0개).');
    return;
  }

  // 기존 이슈 검색 (동일한 제목의 열린 이슈가 있는지 확인)
  const existingIssues = await github.rest.issues.listForRepo({
    owner: context.repo.owner,
    repo: context.repo.repo,
    state: 'open',
    labels: `translation-refused,${game}`
  });

  // 모드별로 항목 그룹화 (prototype pollution 방지)
  const itemsByMod = Object.create(null);
  for (const item of data.items) {
    if (!itemsByMod[item.mod]) {
      itemsByMod[item.mod] = [];
    }
    itemsByMod[item.mod].push(item);
  }

  for (const [mod, items] of Object.entries(itemsByMod)) {
    const title = `[${game.toUpperCase()}] 번역 거부 항목 발생: ${mod}`;

    // 동일한 제목의 열린 이슈가 있는지 확인
    const existingIssue = existingIssues.data.find(issue => issue.title === title);

    // 이슈 본문 생성
    let body = `## 번역 거부 항목\n\n`;
    body += `**게임**: ${game.toUpperCase()}\n`;
    body += `**모드**: ${mod}\n`;
    body += `**발생 시간**: ${data.timestamp}\n\n`;
    body += `### 항목 목록\n\n`;
    body += `| 파일 | 키 | 원문 |\n`;
    body += `|------|-----|------|\n`;

    for (const item of items) {
      const rawMessage = item.message;
      const escapedMessage = rawMessage.replace(/\|/g, '\\|').replace(/\n/g, ' ').replace(/`/g, '\\`');
      let displayMessage = escapedMessage;
      let detailsSection = '';
      // 긴 메시지는 잘라서 표시하고, 전체 메시지는 접을 수 있는 섹션으로 표시
      if (rawMessage.length > 100 || rawMessage.includes('\n')) {
        displayMessage = escapedMessage.slice(0, 100) + '...';
        const detailsMessage = rawMessage.replace(/\|/g, '\\|').replace(/`/g, '\\`');
        detailsSection = `<details><summary>전체 메시지 보기</summary>\n\n\`\`\`\n${detailsMessage}\n\`\`\`\n\n</details>\n`;
      }
      body += `| ${item.file} | \`${item.key}\` | ${displayMessage} |\n`;
      if (detailsSection) {
        body += detailsSection;
      }
    }

    body += `\n---\n`;
    body += `이 이슈는 자동으로 생성되었습니다. 수동 번역이 필요한 항목입니다.\n`;

    if (existingIssue) {
      // 기존 이슈에 코멘트 추가
      await github.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: existingIssue.number,
        body: `## 추가 번역 거부 항목 발견\n\n${body}`
      });
      console.log(`기존 이슈 #${existingIssue.number}에 코멘트를 추가했습니다.`);
    } else {
      // 새 이슈 생성
      const newIssue = await github.rest.issues.create({
        owner: context.repo.owner,
        repo: context.repo.repo,
        title: title,
        body: body,
        labels: ['translation-refused', game]
      });
      console.log(`새 이슈 #${newIssue.data.number}를 생성했습니다.`);
    }
  }
};
