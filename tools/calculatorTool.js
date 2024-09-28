import { tool } from '@langchain/core/tools';
import { z } from "zod";

const calculatorSchema = z.object({
    number1: z.number().describe("The first number to operate on."),
    number2: z.number().describe("The second number to operate on."),
    operation: z
        .enum(["add", "subtract", "multiply", "divide"])
        .describe("The type of operation to execute.")
})

export const calculatorTool = tool(
    async ({ operation, number1, number2 }) => {
        if (operation === "add") {
            return `${number1 + number2}`;
        }
        else if (operation === "subtract") {
            return `${number1 - number2}`;
        }
        else if (operation === "multiply") {
            return `${number1 * number2}`;
        }
        else if (operation === "divide") {
            return `${number1 / number2}`;
        } else {
            throw new Error(`Invalid operation: ${operation}`);
        }
    },
    {
        name: "calculator",
        description: "A tool that performs basic arithmetic operations.",
        schema: calculatorSchema,
    }
);