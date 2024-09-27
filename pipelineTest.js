import { AutoTokenizer, AutoModelForSequenceClassification } from '@xenova/transformers';

const model_id = 'mixedbread-ai/mxbai-rerank-base-v1';
const model = await AutoModelForSequenceClassification.from_pretrained(model_id);
const tokenizer = await AutoTokenizer.from_pretrained(model_id);

// Example usage:
const query = "Who wrote 'To Kill a Mockingbird'?"
const documents = [
    "'To Kill a Mockingbird' is a novel by Harper Lee published in 1960. It was immediately successful, winning the Pulitzer Prize, and has become a classic of modern American literature.",
    "The novel 'Moby-Dick' was written by Herman Melville and first published in 1851. It is considered a masterpiece of American literature and deals with complex themes of obsession, revenge, and the conflict between good and evil.",
    "Harper Lee, an American novelist widely known for her novel 'To Kill a Mockingbird', was born in 1926 in Monroeville, Alabama. She received the Pulitzer Prize for Fiction in 1961.",
    "Jane Austen was an English novelist known primarily for her six major novels, which interpret, critique and comment upon the British landed gentry at the end of the 18th century.",
    "The 'Harry Potter' series, which consists of seven fantasy novels written by British author J.K. Rowling, is among the most popular and critically acclaimed books of the modern era.",
    "'The Great Gatsby', a novel written by American author F. Scott Fitzgerald, was published in 1925. The story is set in the Jazz Age and follows the life of millionaire Jay Gatsby and his pursuit of Daisy Buchanan."
]

async function rank(query, documents, {
    top_k = undefined,
    return_documents = false,
} = {}) {
    const inputs = tokenizer(
        // Form pairs of documents and the query paired up
        new Array(documents.length).fill(query),
        {
            text_pair: documents,
            padding: true,
            truncation: true,
        }
    )
    const { logits } = await model(inputs);
    return logits
        .sigmoid()
        .tolist()
        .map(([score], i) => ({
            corpus_id: i,
            score,
            ...(return_documents ? { text: documents[i] } : {})
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, top_k);
}

const results = await rank(query, documents, { return_documents: true, top_k: 3 });
console.log(results);