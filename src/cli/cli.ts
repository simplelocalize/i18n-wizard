"use strict";
import { bold, greenBright } from "colorette";
import { generatePrompt } from "../../prompt";

const fs = require("fs");
const glob = require("glob");
const OpenAI = require("openai");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const diff = require("diff");

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
  .string("openAiKey")
  .string("openAiModel")
  .string("output")
  .boolean("generateDiff")
  .boolean("applyDiff")
  .argv;

const outputFile = argv?.output || "extraction.json";

const execute = async () => {
  console.log(greenBright("Working..."));
  const input = argv._[argv._.length - 1];
  const example = "--input /src/**/*.{tsx,ts}";
  if (!input) {
    console.error(`Please provide an input directory, at the end of the command. Example: ${bold(`npx @simplelocalize/string-to-i18n --openAiKey your-key ${greenBright(example)}`)}`);
    return;
  }

  const openAiKey = argv?.openAiKey || process.env["OPENAI_API_KEY"];
  const generateDiff = argv?.generateDiff;
  if (!openAiKey && generateDiff) {
    console.error(`Please provide an OpenAI API key using ${bold(`--openAiKey`)} or by setting ${bold(`OPENAI_API_KEY`)} environment variable to generate diff patches`);
    return;
  }

  if (generateDiff) {
    client = new OpenAI({
      apiKey: argv?.openAiKey || process.env["OPENAI_API_KEY"] // This is the default and can be omitted
    });
  }

  const filePaths = glob.sync(input);
  console.log(`Found ${bold(filePaths.length)} files to process`);

  let counter = 1;
  fs.writeFileSync(outputFile, "{}", "utf8");
  for (const filePath of filePaths) {
    console.log(`${bold(`[${counter}/${filePaths.length}] Processing:`)} ${filePath}`);
    if (argv.generateDiff) {
      await generateDiffWithOpenAI(filePath);
    } else {
      console.log(`Skipping diff generation, use ${bold(`--generateDiff`)} to generate diff patches`);
    }
    if (argv.applyDiff) {
      applyDiffPatch(filePath);
    } else {
      console.log(`Skipping diff application, use ${bold(`--applyDiff`)} to apply diff patches`);
    }
    counter++;
  }
};

const generateDiffWithOpenAI = async (filePath: string) => {
  const fileWithTranslations = fs.readFileSync(outputFile, "utf8");
  const translations = JSON.parse(fileWithTranslations);
  const openAiAnswer = await askOpenAI(filePath);
  const diffPatch = openAiAnswer?.diffPatch || "";
  const extractedTranslationKeys = openAiAnswer?.extractedTranslationKeys || [];

  for (let extractedTranslationKey of extractedTranslationKeys) {
    const translationKey = extractedTranslationKey.translationKey;
    const text = extractedTranslationKey.text;
    translations[translationKey] = {
      defaultMessage: text,
      source: filePath
    };
  }
  fs.writeFileSync(filePath + ".diff", diffPatch, "utf8");
  fs.writeFileSync(outputFile, JSON.stringify(translations, null, 2), "utf8");
};

const applyDiffPatch = (filePath: string) => {
  const diffFilePath = filePath + ".diff";
  if (!fs.existsSync(diffFilePath)) {
    return;
  }
  const diffPatch = fs.readFileSync(diffFilePath, "utf8");
  const fileContent = fs.readFileSync(filePath, "utf8");
  const patches = diff.parsePatch(diffPatch);
  const patchedContent = diff.applyPatch(fileContent, patches);
  fs.writeFileSync(filePath, patchedContent, "utf8");
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
  const content = generatePrompt({
    filePath,
    fileContent
  });

  const result = await client.chat.completions.create({
    messages: [
      {
        role: "user",
        content
      }
    ],
    model: argv?.openAiModel || "gpt-4o",
  });

  console.log(result);

  const response = result.choices[0].message.content;
  console.log(response);
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
    console.log(greenBright("Done!"));
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
