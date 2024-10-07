interface PromptArguments {
  filePath: string;
  fileContent: string;
}

const generatePrompt = (args: PromptArguments): string => {
  return `You are a developer working on a React project that needs to be translated into multiple languages. You have a source code file that is at ${args.filePath} with the following content: ${args.fileContent}
  
  - Find all texts in the source code that should be translated and provide the translation key and the default message.
  - If there is nothing to translate, you can respond with an empty diff patch and an empty list of extracted translations.
  - Use FormatJS libraries to handle translations.
  - Provide a valid diff patch (use Unified Diff format) with the changes needed to add the translation key to the source code, including the default message and any necessary changes to the code.
  - Provide a list of extracted translations with the translation key and the default message in the following format: [{"k": "translation key", "m": "default message"}], where "k" is the translation key and "m" is the default message.
  - Generate response as a minified valid JSON that looks like this: {"d": "diff patch", "e": [{"k": "translation key", "m": "default message"}]}
  `;
};

export { generatePrompt };
