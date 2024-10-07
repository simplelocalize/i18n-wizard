"use strict";
import { bold, greenBright } from "colorette";

const fs = require("fs");
const glob = require("glob");
const path = require("path");
const OpenAI = require("openai");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");

interface ExtractedTranslation {
  translationKey: string;
  text: string;
}

interface OpenAiAnswer {
  diffPatch: string;
  extractedTranslationKeys: ExtractedTranslation[];
}

let client = null;

const argv = yargs(hideBin(process.argv))
  .option("apiKey")
  .boolean("overwrite")
  .boolean("debug").argv;

const execute = async () => {
  console.log("Starting extraction...");
  const directory = argv._[argv._.length - 1];
  if (!directory) {
    console.log("No directory provided");
    return;
  }

  if (argv.debug) {
    console.log(bold("Directory: ") + path.resolve(directory));
  }
  const filePaths = glob.sync(directory + "/**/*.tsx");

  const isExists = fs.existsSync("extraction.json", "utf8");
  if (!isExists) {
    fs.writeFileSync("extraction.json", "{}", "utf8");
  }

  if (argv.overwrite) {
    fs.writeFileSync("extraction.json", "{}", "utf8");
  }

  client = new OpenAI({
    apiKey: argv.apiKey || process.env["OPENAI_API_KEY"] // This is the default and can be omitted
  });

  try {
    JSON.parse(fs.readFileSync("extraction.json", "utf8"));
  } catch (e) {
    console.log("extraction.json is not a valid JSON file");
  }

  for (const filePath of filePaths) {
    console.log("Processing: " + filePath);
    await processFile(filePath);
  }
};

const processFile = async (filePath: string) => {
  const fileWithTranslations = fs.readFileSync("extraction.json", "utf8");
  const translations = JSON.parse(fileWithTranslations);

  const processedFileContent = await askOpenAI(filePath);
  const diffPatch = processedFileContent?.diffPatch || "";
  const extractedTranslationKeys = processedFileContent?.extractedTranslationKeys || [];

  for (let extractedTranslationKey of extractedTranslationKeys) {
    const translationKey = extractedTranslationKey.translationKey;
    const text = extractedTranslationKey.text;
    translations[translationKey] = {
      defaultMessage: text,
      source: filePath
    };
  }
  fs.writeFileSync(filePath + ".diff", diffPatch, "utf8");
  fs.writeFileSync("extraction.json", JSON.stringify(translations, null, 2), "utf8");
};


interface OpenAiExtractionItem {
  k: string,
  m: string,
}

interface OpenAiRawAnswer {
  d: string,
  e: OpenAiExtractionItem[]
}

const askOpenAI = async (filePath: string): Promise<OpenAiAnswer> => {
  const fileContent = fs.readFileSync(filePath, "utf8");

  const content = `
  You are a developer working on a React project that needs to be translated into multiple languages. You have a source code file that is at ${filePath} with the following content:
  ${fileContent}
  
  Find all texts in the source code that should be translated and provide the translation key and the default message.
  If the source code file is already in the correct format, you can respond with an empty diff patch and an empty list of extracted translations.
  Use FormatJS libraries to handle translations.
  Response format:
  - Provide a diff patch with the changes needed to extract the translations.
  - Provide a list of extracted translations with the translation key and the default message.
  Response as a minified valid JSON that looks like this: {"d": "diff patch", "e": [{"k": "translation key", "m": "default message"}]}
  `;

  const result = await client.chat.completions.create({
    messages: [{ role: "user", content }],
    model: "gpt-3.5-turbo"
  });
  const response = result.choices[0].message.content;
  const answer = JSON.parse(response) as OpenAiRawAnswer;
  return {
    diffPatch: answer.d,
    extractedTranslationKeys: (answer?.e || []).map(item => ({
      translationKey: item.k,
      text: item.m
    }))
  };
};

(async () => {
  try {
    await execute();
    console.log(greenBright("Finished!"));
    process.exit(0);
  } catch (e) {
    console.log("");
    console.log(e.message);
    const data = e?.response?.data || "";
    if (data) {
      console.log(data);
    }
    process.exit(1);
  }
})();
