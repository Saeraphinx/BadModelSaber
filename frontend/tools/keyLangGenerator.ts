import * as en from "../messages/en-US.json" with { type: "json" };
// @ts-ignore why do i need to do this
import * as fs from "node:fs";

let outputObj: {
    [key: string]: string | any;
} = {}

function owoify(str: string) {
    let owoFaces = [
        "OwO", "Owo", "owO", "ÓwÓ", "ÕwÕ", "@w@", "ØwØ", "øwø", "uwu", "UwU", "☆w☆", "✧w✧", "♥w♥", "゜w゜", "◕w◕",
        "ᅌwᅌ", "◔w◔", "ʘwʘ", "⓪w⓪", " ︠ʘw ︠ʘ", "(owo)"
    ];

    if (!str || str.trim().length == 0)
        return str;


    str = str.replaceAll('r', 'w').replaceAll('l', 'w').replaceAll('R', 'W').replaceAll('L', 'W');

    switch (Math.random() * 2) {
        case 0:
            str = str.replaceAll("n", "ny");
            break;
        case 1:
            str = str.replaceAll("n", "nya");
            break;
    }

    switch (Math.random() * 2) {
        case 0:
            str = str.replaceAll("!", "!");
            break;
        case 1:
            str = str.replaceAll("!", ` ${owoFaces[Math.floor(Math.random() * owoFaces.length)]}!`);
            break;
    }

    switch (Math.random() * 2) {
        case 0:
            str = str.replaceAll("?", "?!");
            break;
        case 1:
            str = str.replaceAll("?",  ` ${owoFaces[Math.floor(Math.random() * owoFaces.length)]}?`);
            break;
    }

    return str;
}

function processObj(obj: any, parentKey = "") {
    for (const key in obj) {
        const value = obj[key];
        const newKey = parentKey && parentKey !== `default` ? `${parentKey}.${key}` : key;
        if (newKey === `$schema`) continue; // skip $schema keys
        if (typeof value === "string") {
            outputObj[newKey] = value;
        } else if (Array.isArray(value)) {
            outputObj[newKey] = value;
        } else {
            processObj(value, newKey);
        }
    }
}


processObj(en);
for (const key in outputObj) {
    if (typeof outputObj[key] === "string" && !outputObj[key].includes("{")) {
        outputObj[key] = owoify(outputObj[key]);
    }
}
let outputPath = "./messages/owo.json";
fs.writeFileSync(outputPath, JSON.stringify(outputObj, null, 2));
for (const key in outputObj) {
    if (typeof outputObj[key] === "string") {
        outputObj[key] = key;
    }
}
fs.writeFileSync("./messages/keys.json", JSON.stringify(outputObj, null, 2));