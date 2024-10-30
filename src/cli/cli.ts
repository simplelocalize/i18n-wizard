"use strict";
import { bold, greenBright, redBright } from "colorette";
import { OpenAiAnswer, OpenAiRawAnswer } from "./types";
import glob from "glob";
import fs from "fs";
import OpenAI from "openai";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import diff from "diff";

let client = null;
let argv = null;

const execute = async () => {
  argv = await yargs(hideBin(process.argv))
    .string("output")
    .string("prompt")
    .string("openAiKey")
    .string("openAiModel")
    .boolean("generateDiff")
    .boolean("applyDiff")
    .argv;


  // validate input
  const input = argv._[argv._.length - 1];
  const example = "--input /src/**/*.{tsx,ts}";
  if (!input) {
    throw new Error(`Please provide an input directory, at the end of the command. Example: ${bold(`npx @simplelocalize/string-to-i18n --openAiKey your-key ${greenBright(example)}`)}`);
  }

  const filePathsToProcess = glob.sync(input);
  console.log(`Found ${bold(filePathsToProcess.length)} files to process`);

  // validate prompt file
  const prompt = argv?.prompt;
  const isPromptFileExists = fs.existsSync("prompt.txt");
  if (!isPromptFileExists && !prompt) {
    throw new Error(`Please provide a prompt file using ${bold(`--prompt`)} flag or create a file named ${bold(`prompt.txt`)}`);
  }

  if (prompt) {
    const isPromptFileExists = fs.existsSync(prompt);
    if (!isPromptFileExists) {
      throw new Error(`Prompt file does not exist: ${prompt}`);
    }
  }

  // validate openai key
  const openAiKey = argv?.openAiKey || process.env["OPENAI_API_KEY"];
  const generateDiff = argv?.generateDiff;
  if (!openAiKey && generateDiff) {
    throw new Error(`Please provide an OpenAI API key using ${bold(`--openAiKey`)} or by setting ${bold(`OPENAI_API_KEY`)} environment variable to generate diff patches`);
  }

  if (generateDiff) {
    client = new OpenAI({
      apiKey: argv?.openAiKey || process.env["OPENAI_API_KEY"]
    });
  }

  let processedFilesCounter = 1;
  const outputFile = argv?.output || "extraction.json";
  console.log(`Output file: ${outputFile}`);
  fs.writeFileSync(outputFile, "{}", "utf8");


  if (!argv.generateDiff) {
    console.log(`Diff generation ${redBright("disabled")}, use ${bold(`--generateDiff`)} to generate diff patches`);
  } else {
    console.log(`Diff generation ${greenBright("enabled")}`);
  }

  if (!argv.applyDiff) {
    console.log(`Diff application ${redBright("disabled")}, use ${bold(`--applyDiff`)} to apply diff patches`);
  } else {
    console.log(`Diff application ${greenBright("enabled")}`);
  }

  for (const filePath of filePathsToProcess) {

    console.log(`${bold(`[${processedFilesCounter}/${filePathsToProcess.length}] Processing:`)} ${filePath}`);

    const openAiAnswer = await askOpenAI(filePath);

    const fileWithTranslations = fs.readFileSync(outputFile, "utf8");
    const translations = JSON.parse(fileWithTranslations);
    const extractedTranslationKeys = openAiAnswer?.extractedTranslationKeys || [];
    for (let extractedTranslationKey of extractedTranslationKeys) {
      const translationKey = extractedTranslationKey.translationKey;
      const text = extractedTranslationKey.text;
      translations[translationKey] = {
        defaultMessage: text,
        source: filePath
      };
    }
    fs.writeFileSync(outputFile, JSON.stringify(translations, null, 2), "utf8");

    const diffPatch = openAiAnswer?.diffPatch || "";
    if (argv.generateDiff) {
      fs.writeFileSync(filePath + ".diff", diffPatch, "utf8");
    }

    try {
      if (argv.applyDiff) {
        applyDiffPatch(filePath);
      }
    } catch (e) {
      console.error(`Error occurred while applying diff patch: ${filePath}`);
      console.error(e);
    }
    processedFilesCounter++;
  }
};

const applyDiffPatch = (filePath: string) => {
  const diffFilePath = filePath + ".diff";
  if (!fs.existsSync(diffFilePath)) {
    return;
  }
  const diffPatch = fs.readFileSync(diffFilePath, "utf8");
  const fileContent = fs.readFileSync(filePath, "utf8");
  const patches = diff.parsePatch(diffPatch);
  let outputFileContent = fileContent;
  for (const patch of patches) {
    const patchedContent = diff.applyPatch(fileContent, patch);
    if (patchedContent) {
      outputFileContent = patchedContent;
    }
  }
  fs.writeFileSync(filePath, outputFileContent, "utf8");
};

const askOpenAI = async (filePath: string): Promise<OpenAiAnswer> => {
  const prompt = buildPrompt(filePath);
  const model = argv?.openAiModel || "gpt-4o";
  const result = await client.chat.completions.create({
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    model
  });

  const response = result?.choices?.[0]?.message?.content;
  if (!response) {
    console.warn("OpenAI response is empty");
    return {
      diffPatch: "",
      extractedTranslationKeys: []
    };
  }
  const answer = JSON.parse(response) as OpenAiRawAnswer;

  const extractedTranslationKeys = (answer?.e || []).map(item => ({
    translationKey: item.k,
    text: item.m
  }));

  console.log(`Extracted ${bold(extractedTranslationKeys.length)} ${bold("translation keys")}`);
  return {
    diffPatch: answer.d,
    extractedTranslationKeys
  };
};

const buildPrompt = (filePath: string): string => {
  const promptPath = argv.prompt;
  const fileContent = fs.readFileSync(filePath, "utf8");
  const promptContent = fs.readFileSync(promptPath, "utf8");
  return promptContent
    .replace("{__filePath__}", filePath)
    .replace("{__fileContent__}", fileContent);
};

(async () => {
  try {
    await execute();
    console.log(greenBright("Done!"));
    process.exit(0);
  } catch (e) {
    console.error("Error occurred:");
    console.error(e.message);
    const data = e?.response?.data || "";
    if (data) {
      console.error(data);
    }
    process.exit(1);
  }
})();
