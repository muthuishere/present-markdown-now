import fs, {promises as fsPromises} from "fs";
import path from "path";
import marpCLI from '@marp-team/marp-cli/lib/marp-cli.js';


import {getCurrentProjectFolder} from "./os_utils.js";

let projectRunningFolder = null;

export function setProjectRunningFolder(folder) {

    if (fs.existsSync(folder) === false)
        throw new Error("Folder does not exist " + folder)

    projectRunningFolder = folder;

}

export function getOutputFolder() {

    let outputfolder = getCurrentProjectFolder() + "/dist/";


    if (fs.existsSync(outputfolder) === false)
        fs.mkdirSync(outputfolder, {recursive: true})
    return outputfolder;


}

export async function copyAssetsToOutputFolder(srcfolder) {
    const outputfolder = getOutputFolder()

    await copyFilesByExtension(srcfolder, outputfolder, ['png', 'gif', 'svg', 'jpg', 'css', 'scss']);

}


export function copyFilesByExtension(sourceDir, targetDir, extensions) {
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, {recursive: true});
    }

    copyFilesRecursive(sourceDir, targetDir);

    function copyFilesRecursive(currentSourceDir, currentTargetDir) {
        const files = fs.readdirSync(currentSourceDir, {withFileTypes: true});

        for (const file of files) {
            if (file.isDirectory()) {
                const newSourceDir = path.join(currentSourceDir, file.name);
                const newTargetDir = path.join(currentTargetDir, file.name);
                if (!fs.existsSync(newTargetDir)) {
                    fs.mkdirSync(newTargetDir);
                }
                copyFilesRecursive(newSourceDir, newTargetDir);
            } else {
                const extname = path.extname(file.name).slice(1); // Remove the leading dot
                if (extensions.includes(extname)) {
                    const sourceFile = path.join(currentSourceDir, file.name);
                    const targetFile = path.join(currentTargetDir, file.name);
                    fs.copyFileSync(sourceFile, targetFile);
                }
            }
        }
    }
}


export const formatContents = (data) => {
    // Use a regular expression to match lines that start with '#', followed by a space, followed by one to three numbers, another space, and then a '-'

    const regex = /^#\s[1-9]{1,3}\s-.*$/gm;
    const matches = data.match(regex);

    if (!matches) {
        return "";
    }
    const processedMatches = matches.map(line => {
        // Remove starting '#'
        const header = line.replace(/^#/, '').trim().split('-')[1].trim();
        let newLine = line.replace(/^#/, '').trim()
        // Convert to lowercase
        newLine = newLine.toLowerCase();
        // Replace spaces with '-'
        newLine = newLine.replace(/\s+/g, '-');
        return `1. [${header}](#${newLine})`;

    });

    // Convert the processed matches to an array and join by new line
    return processedMatches.join('\n');

};

export const replaceContentsInMarkdown = (markdownFile, resultFile) => {


    return new Promise((resolve, reject) => {


        // Check if the input file exists
        if (!fs.existsSync(markdownFile)) {
            reject("Markdown file does not exist!");
            return;
        }

        // Read the file
        fs.readFile(markdownFile, 'utf8', (err, data) => {
            if (err) {
                reject("Error reading the file:" + err.toString());
                return;
            }

            const formattedData = formatContents(data);

            // console.log("Formatted data:", formattedData);

            // Replace ###CONTENTS### with the formatted text
            const updatedData = data.replace('###CONTENTS###', formattedData);

            // Write the updated data to the result file
            fs.writeFile(resultFile, updatedData, 'utf8', (err) => {
                if (err) {
                    reject("Error writing to the result file:" + err.toString());
                    return;
                }
                // console.log(`File has been saved as ${resultFile}`);
                resolve(resultFile);
            });
        });
    });
};


export async function convertToHtml(filename) {


    const basename = path.basename(filename);

    let htmlFile = basename.replace(".md", ".html");


    return convertToHtmlWithFileName(filename, htmlFile);


}

export async function convertToHtmlWithFileName(filename, htmlFile) {


    const outputfolder = getOutputFolder()
    const outputfile = outputfolder + htmlFile;

//{ onlyScanning: true }
    const args = [filename, '-o', outputfile];

    await buildWithMarpCli(args)

    // await marpCLI.cliInterface(args)
    return htmlFile;


}

export async function buildWithMarpCli(args) {
    const originalConsoleLog = console.warn;

// Override console.log to do nothing
    console.warn = function () {
    };

    try {
        // Call your function without console.log output
        await marpCLI.cliInterface(args);
    } catch (e) {
        // Handle any errors that may occur
        console.error(e);
    } finally {
        // Restore the original console.log function
        console.warn = originalConsoleLog;
    }

}

export async function generateHtmlWithScript(filename, scriptFile, generatedFileName) {
    // console.log("Converting to HTML", filename);
    const outputfolder = getOutputFolder()
    const tempHtmlFile = outputfolder + "temp.html";
    const finalHtmlFile = outputfolder + generatedFileName;

    // Use Marp CLI to convert to temp.html
    const args = [filename, '-o', tempHtmlFile];
    await marpCLI.cliInterface(args);

    // Read the temp HTML file
    let htmlContent = await fsPromises.readFile(tempHtmlFile, 'utf8');

    //read the script file
    let scriptContent = await fsPromises.readFile(scriptFile, 'utf8');

    // Script to be inserted
    const scriptTag = '<script>' + scriptContent + '</script>';

    // Insert the script tag before the closing </body> tag
    htmlContent = htmlContent.replace('</body>', `${scriptTag}\n</body>`);

    console.log("Writing to index.html", finalHtmlFile);
    // Write the modified content to index.html
    await fsPromises.writeFile(finalHtmlFile, htmlContent, 'utf8');

    // Delete temp.html
    await fsPromises.unlink(tempHtmlFile);

    return finalHtmlFile;
}