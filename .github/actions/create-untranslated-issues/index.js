const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const path = require('path');
const { githubApiRetry } = require('./github-retry.cjs');

// 테이블에서 키를 추출하기 위한 정규식: | 파일 | `키` | 원문 | 형식
const TABLE_KEY_REGEX = /\|\s*[^|]+\s*\|\s*`([^`]+)`\s*\|/g;

/**
 * 항목을 테이블 행으로 포맷팅
 * @param {Object} item - 항목 객체 (file, key, message 포함)
 * @returns {string} 포맷된 테이블 행 문자열
 */
function formatItemAsTableRow(item) {
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
  
  let row = `| ${item.file} | \`${item.key}\` | ${displayMessage} |\n`;
  if (detailsSection) {
    row += detailsSection;
  }
  return row;
}

async function run() {
  try {
    // 복합 액션에서는 INPUT_ 환경 변수를 직접 읽어야 함
    const game = process.env.INPUT_GAME;
    const token = process.env.INPUT_GITHUB_TOKEN;

    if (!game) {
      core.setFailed('game input is required');
      return;
    }
    if (!token) {
      core.setFailed('github-token input is required');
      return;
    }

    // game 이름을 대문자로 변환 (이슈 제목용)
    const gameDisplayName = game === 'ck3' ? 'CK3' : 
                            game === 'vic3' ? 'VIC3' : 
                            game === 'stellaris' ? 'Stellaris' : game;

    const octokit = github.getOctokit(token);
    const { context } = github;

    const filePath = path.join(process.cwd(), `${game}-untranslated-items.json`);

    if (!fs.existsSync(filePath)) {
      core.info('번역되지 않은 항목이 없습니다.');
      return;
    }

    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (error) {
      core.setFailed(`Failed to parse ${filePath}: ${error.message}. The file may contain invalid JSON.`);
      return;
    }

    if (!data.items || data.items.length === 0) {
      core.info('번역되지 않은 항목이 없습니다.');
      return;
    }

    // timestamp 필드 검증 및 기본값 설정
    const timestamp = data.timestamp || '알 수 없음';

    // 기존 이슈 검색 (동일한 제목의 열린 이슈가 있는지 확인)
    const existingIssues = await githubApiRetry(() => octokit.rest.issues.listForRepo({
      owner: context.repo.owner,
      repo: context.repo.repo,
      state: 'open',
      labels: `translation-refused,${game}`
    }), '이슈 목록 조회');

    // 모드별로 항목 그룹화 (prototype pollution 방지)
    const itemsByMod = Object.create(null);
    for (const item of data.items) {
      // 필수 속성 검증
      if (
        !item ||
        typeof item.mod !== 'string' ||
        typeof item.file !== 'string' ||
        typeof item.key !== 'string' ||
        typeof item.message !== 'string'
      ) {
        core.warning(`Skipping item with missing required properties: ${JSON.stringify(item)}`);
        continue;
      }
      if (!itemsByMod[item.mod]) {
        itemsByMod[item.mod] = [];
      }
      itemsByMod[item.mod].push(item);
    }

    for (const [mod, items] of Object.entries(itemsByMod)) {
      const title = `[${gameDisplayName}] 번역 거부 항목 발생: ${mod}`;

      // 동일한 제목의 열린 이슈가 있는지 확인
      const existingIssue = existingIssues.data.find(issue => issue.title === title);

      if (existingIssue) {
        // 기존 이슈 본문에서 이미 존재하는 키 추출
        const existingBody = existingIssue.body || '';
        const existingKeys = new Set();
        // 전역 플래그 정규식 사용 시 lastIndex 초기화 필요
        TABLE_KEY_REGEX.lastIndex = 0;
        let match;
        while ((match = TABLE_KEY_REGEX.exec(existingBody)) !== null) {
          existingKeys.add(match[1]);
        }

        // 새로운 항목만 필터링 (중복 제거)
        const newItems = items.filter(item => !existingKeys.has(item.key));

        if (newItems.length === 0) {
          core.info(`기존 이슈 #${existingIssue.number}에 새로운 항목이 없습니다.`);
          continue;
        }

        // 기존 본문에서 마지막 업데이트 시간 부분과 footer 제거
        let updatedBody = existingBody.replace(/\*\*마지막 업데이트\*\*:.*?\n+/s, '');
        updatedBody = updatedBody.replace(/\n---\n[\s\S]*$/s, '');

        // 테이블이 실제로 시작하는 위치 찾기
        const lines = updatedBody.split('\n');
        let tableStartLine = -1;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trim().startsWith('|')) {
            tableStartLine = i;
            break;
          }
        }

        if (tableStartLine === -1) {
          core.warning('테이블을 찾을 수 없습니다');
          continue;
        }

        // 테이블 끝 위치 찾기 (테이블 시작점부터 검사)
        // 알고리즘:
        // 1. tableStartLine + 2부터 시작 (헤더와 구분선 건너뛰기)
        // 2. 테이블 행(|로 시작), <details> 섹션, 빈 줄을 모두 테이블의 일부로 간주
        // 3. 테이블 구조가 아닌 줄을 만나면 테이블의 끝으로 판단
        let tableEndLine = tableStartLine + 1; // 최소한 구분선 다음에 삽입
        for (let i = tableStartLine + 2; i < lines.length; i++) {
          const line = lines[i].trim();
          // 테이블 행, details 섹션, 빈 줄은 계속 진행
          if (line.startsWith('|') || line.startsWith('<details>') || line.startsWith('</details>') || line === '') {
            tableEndLine = i;
          } else {
            // 그 외의 경우 테이블 끝
            break;
          }
        }

        // insertPosition: tableEndLine 다음 줄의 시작 위치
        let insertPosition = 0;
        if (tableEndLine > 0) {
          // 줄의 끝까지의 길이 합 + 줄 개수만큼의 개행
          insertPosition = lines.slice(0, tableEndLine + 1).join('\n').length;
          // 줄 개수가 1개 이상이면 개행 추가
          if (insertPosition < updatedBody.length) insertPosition += 1;
        } else {
          insertPosition = updatedBody.length;
        }

        // 새 항목들을 테이블에 추가
        let newRows = '';
        for (const item of newItems) {
          newRows += formatItemAsTableRow(item);
        }

        // 본문 업데이트
        updatedBody = updatedBody.slice(0, insertPosition) + newRows + updatedBody.slice(insertPosition);
        updatedBody += `\n**마지막 업데이트**: ${timestamp}\n\n`;
        updatedBody += `---\n`;
        updatedBody += `이 이슈는 자동으로 생성되었습니다. 수동 번역이 필요한 항목입니다.\n`;

        // 이슈 본문 업데이트
        await githubApiRetry(() => octokit.rest.issues.update({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: existingIssue.number,
          body: updatedBody
        }), '이슈 업데이트');
        core.info(`기존 이슈 #${existingIssue.number}의 본문을 업데이트했습니다. (새 항목 ${newItems.length}개 추가)`);
      } else {
        // 새 이슈 생성
        let body = `## 번역 거부 항목\n\n`;
        body += `**게임**: ${gameDisplayName}\n`;
        body += `**모드**: ${mod}\n`;
        body += `**발생 시간**: ${timestamp}\n\n`;
        body += `### 항목 목록\n\n`;
        body += `| 파일 | 키 | 원문 |\n`;
        body += `|------|-----|------|\n`;

        for (const item of items) {
          body += formatItemAsTableRow(item);
        }

        body += `\n---\n`;
        body += `이 이슈는 자동으로 생성되었습니다. 수동 번역이 필요한 항목입니다.\n`;

        const newIssue = await githubApiRetry(() => octokit.rest.issues.create({
          owner: context.repo.owner,
          repo: context.repo.repo,
          title: title,
          body: body,
          labels: ['translation-refused', game]
        }), '이슈 생성');
        core.info(`새 이슈 #${newIssue.data.number}를 생성했습니다.`);
      }
    }
  } catch (error) {
    core.setFailed(error.message);
    if (error.stack) {
      core.debug(error.stack);
    }
  }
}

run();
