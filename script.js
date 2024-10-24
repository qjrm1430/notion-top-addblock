const { Client } = require('@notionhq/client');
require('dotenv').config();

// Initialize the Notion client with your API key from environment variables
const notion = new Client({ auth: process.env.NOTION_TOKEN });

// Replace with your actual database ID from environment variables
const databaseId = process.env.DATABASE_ID;

// YAML 코드 블록 내용
const yamlCode = 'floatFirstTOC: right';

async function getDatabasePages(databaseId) {
  const pages = [];
  let cursor = undefined;

  while (true) {
    const response = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      page_size: 100,
    });

    pages.push(...response.results);

    if (!response.has_more) {
      break;
    }
    cursor = response.next_cursor;
  }

  return pages;
}

async function appendCodeBlock(pageId) {
  try {
    // 1. 첫 번째 블록 가져오기
    const { results: blocks } = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 1
    });

    if (blocks.length === 0) {
      // 블록이 없는 경우 그냥 추가
      await notion.blocks.children.append({
        block_id: pageId,
        children: [{
          object: "block",
          type: "code",
          code: {
            rich_text: [{ 
              type: "text", 
              text: { 
                content: yamlCode 
              } 
            }],
            language: "yaml"
          }
        }]
      });
    } else {
      const firstBlock = blocks[0];
      
      // 2. 첫 번째 블록의 전체 내용을 가져오기
      const blockContent = await notion.blocks.retrieve({
        block_id: firstBlock.id
      });

      // 3. YAML 코드 블록을 첫 번째 블록 뒤에 추가
      const yamlResponse = await notion.blocks.children.append({
        block_id: pageId,
        children: [{
          object: "block",
          type: "code",
          code: {
            rich_text: [{ 
              type: "text", 
              text: { 
                content: yamlCode 
              } 
            }],
            language: "yaml"
          }
        }],
        after: firstBlock.id
      });

      // 4. 첫 번째 블록을 YAML 블록 뒤에 복사
      const newBlockData = {
        object: "block",
        type: blockContent.type,
        [blockContent.type]: blockContent[blockContent.type]
      };

      await notion.blocks.children.append({
        block_id: pageId,
        children: [newBlockData],
        after: yamlResponse.results[0].id
      });

      // 5. 원래 첫 번째 블록 삭제
      await notion.blocks.delete({
        block_id: firstBlock.id
      });
    }

    console.log(`페이지 최상단에 YAML 코드 블록을 삽입했습니다: ${pageId}`);
  } catch (error) {
    console.error(`페이지 업데이트 실패 ${pageId}: ${error.message}`);
    console.error('Error details:', error);
  }
}

async function main() {
  // 모든 페이지 가져오기
  const pages = await getDatabasePages(databaseId);
  console.log(`데이터베이스에서 ${pages.length}개의 페이지를 찾았습니다.`);

  // 각 페이지 처리
  for (const page of pages) {
    const pageId = page.id; // 하이픈 포함 ID 사용
    await appendCodeBlock(pageId);
  }

  console.log('모든 페이지 처리 완료.');
}

main().catch((error) => {
  console.error(error);
});
