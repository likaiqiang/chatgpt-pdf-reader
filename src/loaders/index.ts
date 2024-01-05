import PDFLoader from '@/loaders/pdf';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import path from 'path';
import {Document} from '@/types/document'
import {Parser} from '@/electron/tree-sitter';
import Javascript from '@/electron/tree-sitter/javascript';
import Cpp from '@/electron/tree-sitter/cpp';
import Go from '@/electron/tree-sitter/go';
import Java from '@/electron/tree-sitter/java';
import Php from '@/electron/tree-sitter/php';
import Python from '@/electron/tree-sitter/python';
import Ruby from '@/electron/tree-sitter/ruby';
import Rust from '@/electron/tree-sitter/rust';
import Scala from '@/electron/tree-sitter/scala';
import Markdown from '@/electron/tree-sitter/markdown';
import Html from '@/electron/tree-sitter/html';
import Solidity from '@/electron/tree-sitter/solidity';
import Kotlin from '@/electron/tree-sitter/kotlin';
import {embeddingModel, getTokenCount, getMaxToken} from '@/electron/embeddings'


const getLanguageParser = (language: string) =>{
  if (language === 'js') return Javascript;
  if (language === 'cpp') return Cpp;
  if (language === 'go') return Go;
  if (language === 'java') return Java;
  if (language === 'php') return Php;
  if (language === 'python') return Python;
  if (language === 'ruby') return Ruby;
  if (language === 'rust') return Rust;
  if (language === 'scala') return Scala;
  if (language === 'md' || language === 'markdown') return Markdown;
  if (language === 'html') return Html;
  if (language === 'sol') return Solidity;
  if (language === 'kotlin') return Kotlin;
  return null
}

const MAX_SPLIT_LENGTH = getMaxToken(embeddingModel)

const splitCode = (code:string, languageParser = Javascript) =>{
  // 创建一个解析器
  const parser = new Parser();
  // 设置解析器的语言
  parser.setLanguage(languageParser);
  // 解析代码，得到一个语法树
  const tree = parser.parse(code);
  // 获取语法树的根节点
  const root = tree.rootNode;
  // 定义一个数组，用来存储拆分后的代码片段
  const codeFragments = [];
  // 定义一个变量，用来存储当前的代码片段
  let currentFragment = '';
  // 定义一个变量，用来存储当前的代码片段的字符长度
  let currentLength = 0;

  for (const child of root.children) {
    let text = child.text;

    while (text.length > 0) {
      const fragmentLength = getTokenCount(text); // 获取当前文本的token计数

      if (currentFragment === '' || currentLength + fragmentLength <= MAX_SPLIT_LENGTH) {
        // 如果新片段加上当前片段没有超过最大长度，就添加到当前片段
        const chunk = text.substring(0, Math.min(text.length, MAX_SPLIT_LENGTH - currentLength));
        text = text.substring(chunk.length); // 减少text的长度
        currentFragment += ('\n' + chunk);
        currentLength += getTokenCount(chunk); // 更新currentLength为chunk的实际token计数
      } else {
        // 如果当前片段已经满了，将其添加到数组并重置当前片段和长度
        codeFragments.push(currentFragment);
        currentFragment = '';
        currentLength = 0;
        // 注意：在这里不应该做任何有关text的操作。
        // 因为你已经有一个超出MAX_SPLIT_LENGTH的text部分需要在下一个循环中处理。
      }
    }
  }

  if (currentFragment !== '') {
    // 如果不为空，就将当前的代码片段添加到数组中
    codeFragments.push(currentFragment);
  }

  return codeFragments;
}

export const getTextDocs = async ({buffer, filePath}: IngestParams)=>{
  const rawDocsArray = [
      new Document({
        pageContent: buffer as string,
        metadata:{
          source: filePath
        }
      })
  ]
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200
  });
  return await textSplitter.splitDocuments(rawDocsArray);
}


export const getPdfDocs = async ({buffer, filename}: IngestParams)=>{
  const rawDocsArray = await new PDFLoader().parse(buffer as Buffer, { source: filename });
  /* Split text into chunks */
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200
  });
  return await textSplitter.splitDocuments(rawDocsArray);
}
export const getCodeDocs = async ({buffer, filePath}: IngestParams)=>{
  const ext = path.extname(filePath);
  const Parser = getLanguageParser(
      ext.slice(1)
  );
  const chunks = splitCode(buffer as string, Parser);
  const docs: Document[] = chunks.map(chunk=>{
    return new Document({
      pageContent: chunk,
      metadata:{
        source: filePath
      }
    })
  })
  return docs
}
