import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

export const splitText = async (documents) => {
    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 50,
    });

    const splits = await textSplitter.splitDocuments(documents);

    return splits;
}