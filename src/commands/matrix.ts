import gitlog from "gitlog";
import dateFn from "date-fns";
import fs from "fs";
import { markdownTable } from "markdown-table";
import { getContributors } from "../contributors.js";
import { dirname } from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import { Commit } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const outputMarkdownTable = (table: Record<string, Record<string, number>>) => {
  const matrix = [["", ...Object.keys(table)]];

  Object.keys(table).forEach((contributor, cIndex) => {
    let row = [contributor];

    Object.keys(table[contributor]).forEach((pair, pIndex) => {
      if (pIndex < cIndex) {
        row.push(table[contributor][pair].toString());
      } else {
        row.push("");
      }
    });
    matrix.push(row);
  });

  return markdownTable(matrix);
};

const coAuthors = (body: string) => {
  const names = body.match(/Co-authors: (.*)/);
  if (names === null) return [];
  return names[1].split(',').map(name => name.trim());
}

export const matrix = async ({ after }: { after: string }) => {
  const CO_AUTHORS = "Co-authors: ";

  interface PairData {
    count: number;
    lastPair: Date | -1;
  }

  interface PairPartners {
    [key: string]: PairData;
  }

  const matrix: Record<string, PairPartners> = {};

  const contributors = getContributors();

  contributors.forEach((contributor) => {
    matrix[contributor] = {};
    contributors
      .filter((pair) => pair !== contributor)
      .forEach((pair) => {
        matrix[contributor][pair] = { count: 0, lastPair: -1 };
      });
  });

  const options = {
    repo: __dirname,
    number: 500,
    after,
    fields: ["hash", "authorName", "authorDate", "body"] as const,
  };

  try {
    // @ts-ignore
    const commits: Commit[] = await gitlog.gitlogPromise(options);
    const warnings: string[] = [];
    const pairingHistory = commits
      .map(commit => ({commit, pairs: coAuthors(commit.body)}))
      .flatMap(({commit: { authorName, authorDate, hash }, pairs}) =>
        pairs.map((pair: string) => ({ authorName, authorDate, pair, hash }))
      );

    pairingHistory.forEach(({ authorName, pair, hash, authorDate }: Record<string, any>) => {
      if (authorName === pair) {
        warnings.push(
          `Don't include yourself in the "${CO_AUTHORS}" line, ${authorName}. See commit ${hash}`
        );
        return;
      }
      if (!(authorName in matrix)) {
        warnings.push(
          `${authorName} is not a known contributor. See commit ${hash}`
        );
        return;
      }
      if (!(pair in matrix)) {
        warnings.push(`${pair} is not a known contributor. See commit ${hash}`);
        return;
      }

      const date = dateFn.parseISO(authorDate.split(" ")[0]);
      if (!dateFn.isEqual(matrix[authorName][pair].lastPair, date)) {
        matrix[authorName][pair].count += 1;
        matrix[pair][authorName].count += 1;
      }

      matrix[authorName][pair].lastPair = date;
      matrix[pair][authorName].lastPair = date;
    });

    warnings.forEach((warning) => console.warn(warning));

    const table: Record<string, Record<string, number>> = {};

    for (const [contributor, pairs] of Object.entries(matrix)) {
      table[contributor] = {};
      for (const [pair, stats] of Object.entries(pairs)) {
        table[contributor][pair] = stats.count;
      }
    }

    fs.writeFileSync("./.pear/matrix.md", outputMarkdownTable(table), {
      encoding: "utf-8",
    });
  } catch (error) {
      console.error(chalk.redBright(error));
      console.error(
        chalk.redBright(
          "Sorry, we were unable to generate a pairing matrix for your team."
        )
      );
  }
};
