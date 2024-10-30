#!/usr/bin/env node
"use strict";
import { bold, greenBright, redBright } from "colorette";
import { OpenAiAnswer, OpenAiRawAnswer } from "./types";
import glob from "glob";
import fs from "fs";
import OpenAI from "openai";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import diff from "diff";


const DEFAULT_PROMPT_FILENAME = "prompt.txt";
const DEFAULT_OUTPUT_FILENAME = "extraction.json";

let client = null;
let argv = null;

const execute = async () => {
  argv = await yargs(hideBin(process.argv))
    .string("output")
    .string("prompt")
    .string("openAiKey")
    .string("openAiModel")
    .boolean("extractMessages")
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

  if (filePathsToProcess.length > 500) {
    throw new Error(`Safety check: too many files to process (${filePathsToProcess.length}), please narrow down the search`);
  }

  // validate prompt file
  const prompt = argv?.prompt;
  const isPromptFileExists = fs.existsSync(DEFAULT_PROMPT_FILENAME);
  if (!isPromptFileExists && !prompt) {
    throw new Error(`Please provide a prompt file using ${bold(`--prompt`)} flag or create a file named ${bold(DEFAULT_PROMPT_FILENAME)}`);
  }

  if (prompt) {
    const isPromptFileExists = fs.existsSync(prompt);
    if (!isPromptFileExists) {
      throw new Error(`Prompt file does not exist: ${prompt}`);
    }
  }

  const promptPath = argv.prompt || DEFAULT_PROMPT_FILENAME;
  const promptContent = fs.readFileSync(promptPath, "utf8");
  console.log("Loaded prompt:");
  console.log(promptContent);

  // validate openai key
  const openAiKey = argv?.openAiKey || process.env["OPENAI_API_KEY"];
  if (!openAiKey) {
    throw new Error(`Please provide an OpenAI API key using ${bold(`--openAiKey`)} or by setting ${bold(`OPENAI_API_KEY`)} environment variable`);
  }

  client = new OpenAI({
    apiKey: openAiKey
  });

  let processedFilesCounter = 1;
  const outputFile = argv?.output || DEFAULT_OUTPUT_FILENAME;
  console.log(`Output file: ${outputFile}`);
  fs.writeFileSync(outputFile, "{}", "utf8");

  if (argv.extractMessages) {
    console.log(`Messages extraction ${greenBright("enabled")}`);
  } else {
    console.log(`Messages extraction ${redBright("disabled")}, use ${bold(`--extractMessages`)} to extract keys and messages`);
  }

  if (argv.generateDiff) {
    console.log(`Diff generation ${greenBright("enabled")}`);
  } else {
    console.log(`Diff generation ${redBright("disabled")}, use ${bold(`--generateDiff`)} to generate diff patches`);
  }

  if (argv.applyDiff) {
    console.log(`Diff application ${greenBright("enabled")}`);
  } else {
    console.log(`Diff application ${redBright("disabled")}, use ${bold(`--applyDiff`)} to apply diff patches`);
  }

  for (const filePath of filePathsToProcess) {

    console.log(`${bold(`[${processedFilesCounter}/${filePathsToProcess.length}] Processing:`)} ${filePath}`);

    const isOnlyApplyDiff = argv.applyDiff && !argv.extractMessages && !argv.generateDiff;
    if (isOnlyApplyDiff) {
      console.log("Applying diff patch");
      tryToApplyDiffPatch(filePath);
      processedFilesCounter++;
      continue;
    }

    const openAiAnswer = await askOpenAI(filePath);

    if (argv.extractMessages) {
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
    }

    const diffPatch = openAiAnswer?.diffPatch || "";
    if (argv.generateDiff) {
      fs.writeFileSync(filePath + ".diff", diffPatch, "utf8");
    }

    if (argv.applyDiff) {
      tryToApplyDiffPatch(filePath);
    }
    processedFilesCounter++;
  }
};


const tryToApplyDiffPatch = (filePath: string) => {
  try {
    applyDiffPatch(filePath);
  } catch (e) {
    console.error(`Error occurred while applying diff patch: ${filePath}`);
    console.error(e);
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
  fs.unlinkSync(diffFilePath);
};

const askOpenAI = async (filePath: string): Promise<OpenAiAnswer> => {
  const prompt = buildPrompt(filePath);
  const model = argv?.openAiModel || "gpt-3.5-turbo";
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
  console.log("OpenAI response:");
  console.log(response);
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
  const promptPath = argv.prompt || DEFAULT_PROMPT_FILENAME;
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
    console.error(e.message, e.stack);
    const data = e?.response?.data || "";
    if (data) {
      console.error(data);
    }
    process.exit(1);
  }
})();
