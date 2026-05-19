<div align="center">
<h1>BeatMods Verification Guidelines</h1>
<h3>Last Updated: May 19 2026</h3>
</div>

## Definitions
### Plugin
A Plugin is active code, loaded by the plugin architecture (IPA or BSIPA), and executes and affects things independently. It should be a single DLL located in the Plugins folder of a Beat Saber installation. A Plugin can be tagged as a Library on BeatMods if it serves a useful enough purpose to be a dependency of many other mods, such as CustomUI or Beat Saber Utils.
### Library
A Library is exclusively passive code that won’t do anything on its own. It can reside outside of the Plugins folder, in other directories where code is stored. Libraries are used by other Plugins as dependencies, and every Library will get tagged as such on BeatMods. Popular Libraries include Newtonsoft JSON and Harmony.

## Guidelines
### 1. Names and Descriptions
Names and descriptions should be free of any obscene language, including slurs, vulgar language, or sexual content. This includes names and descriptions in the mod's metadata. Mods that violate this rule will be removed from the platform. Additionally, the words "Plugin" and "Mod" shouldn't be used in the name of a mod, as they are redundant. All necessary information to get your mod wortking should be included on your GitHub repository and the description on ModelSaber. If you are using BSIPA, all proper information, including names, description, dependencies, and version, must be included in manifest.json. 

### 2. Versioning
1. All versions of a mod must follow the [Semantic Versioning](https://semver.org/) specification.
2. Versions uploaded to BeatMods are final. They will not be removed unless it is critically necessary.
3. When submitting a mod on BeatMods, both the mod version and name must match on all of the following (Mod name will not be as strictly enforced as version):
    - BeatMods, when publishing your mod
    - Assembly metadata (Located in AssemblyInfo.cs) and the name of the DLL file
    - manifest.json (If using BSIPA)

### 3. Dependencies
All dependencies must be properly declared. If your mod requires a dependency, it must be declared in the manifest.json file (if using BSIPA) and on the BeatMods version submission form.
> [!NOTE]
> **Harmony** is included with BSIPA and does not need to be declared as a dependency. If your mod declares Harmony in it's manifest.json file, it will be removed.

### 4. Zip Contents
Uploaded files should only have one DLL file in either the `Libs` or `Plugins` folder. Plugins may not have any files that are written to in the uploaded file. These will be overwritten when the user re-installs your mod. Instead, consider generating these at runtime with default config options and error handling.

### 5. Obfuscation
While obfuscation is frowned upon, it is not strictly disallowed. If you choose to obfuscate your mod, you must provide the original source code of the mod to the approval team for review. The team must be able to reproduce the obfuscated code from the source code to verify that the obfuscated code is safe. Failure to provide the original source code will result in the mod being rejected. Obfuscated mods are not eligible for the unverified tag. 

### 6. Quality
Mods must be of a certain level of quality to be marked as verified. Mods that do not meet this level of quality might still be allowed on the platform, but they will be marked as unverified. 

1. Obvious joke/meme mods will not be marked as verified. Any mods that include joke/meme settings, such as April Fools jokes must be toggleable in game. 
2. Mods that are unfinished, such as mods that are missing core features or have major bugs that prevent them from being used for their intended purpose will be removed.
3. Mods that interact with external APIs **must** do so over HTTPS/TLS. If a mod is downloading and saving content / running external code from an external source, that source must be verified too.
4. Mods must be fully compatible with the base game and all other approved mods on BeatMods (with the exception of any mods you mark as conflicting). See [Testing in the Modding Guide](https://bsmg.wiki/modding/pc/testing.html) for more information in testing with debug builds.
    a. While unverified mods are allowed a bit of leeway with this rule, they must still be compatible with the base game and not cause any crashes or major issues. Unverified mods that cause crashes or major issues will be removed.
5. If using the Harmony library, be sure to patch/unpatch your changes correctly. Doing so incorrectly can lead to Harmony unloading all patches, and a removal of your mod.

## Verified vs Unverified
Verified mods are mods that have been reviewed by the BeatMods team and have been deemed to meet the quality standards set forth in these guidelines. They will not cause any issues with other verified mods, and are safe to use. 

Unverified mods are mods that have either not been reviewed by the BeatMods team, or have been reviewed and deemed to not meet the quality standards set forth in these guidelines. They may cause issues with other mods, or with the base game, and should be used with caution. While they are usually safe to use, **you should not use unverified mods unless you know what you are doing, and you will not receive support for any issues caused by unverified mods.** Unverified mods will be clearly marked as such on the platform, and users will be warned about the potential risks of using them.