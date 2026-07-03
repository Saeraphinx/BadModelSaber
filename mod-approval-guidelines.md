<div align="center">
<h1>BeatMods Verification Guidelines</h1>
<h3>Last Updated: June 18 2026</h3>
<h4>This date & the changelog will not be updated until the website is released.</h4>
</div>

## Guidelines
### 1\. Project Management
Keep names and content clean:
- No harassment or hate speech.  
- No vulgar or offensive language.  
- No overtly sexual, excessively violent imagery, or explicit adult content (18+ only).  
- Don't put "Plugin" or "Mod" in the name of the mod.

This applies everywhere, including in your mod's metadata. Make sure all of the info someone needs to get your mod up and running is publicly available. If you're using BSIPA, your `manifest.json` must include your mod’s name, description, dependency list, and version.

You are required to declare all your dependencies in your `manifest.json` (if using BSIPA) alongside the submission form. Harmony comes bundled with BSIPA, and therefore should not be listed as a dependency.

### 2\. Versioning
Your project should follow [Semantic Versioning](https://semver.org/) or use a SemVer-adjacent versioning system. Libraries, mods that expose a public API, and mods that get depended on regularly must use SemVer. Once a version is uploaded, it's there for good.   
> [!IMPORTANT]
> Your version number needs to match in all of these places:
> - BeatMods itself  
> - Your assembly metadata (`AssemblyInfo.cs`).  
> - Your mods `manifest.json` (If you're using BSIPA).

### 3\. Zip Contents
Your zip should only contain files in either the `Libs` or `Plugins` folder. Don't bundle files that are written to at runtime as they'll get overwritten whenever someone reinstalls your plugin/library. You should instead create those files at runtime with sensible defaults and error handling.

### 4\. Obfuscation
While obfuscation is frowned upon, it is not strictly disallowed. If you choose to obfuscate your mod, you'll need to check in with Beatmods approval staff. In most cases, obfuscated mods will not be verified. 

**Obfuscated mods must go through the full verification process and are not allowed to have a status of unverified.**

### 5\. Quality
In order for a mod to be verified, it must have a decent level of quality. If it doesn't quite get there, it may still be allowed on the platform but marked as unverified.

1. **Your mod needs to work:** If your mod is missing core features or has bugs that stop it from doing what it's supposed to do, it'll be removed. [^1]  
2. **Mods must not throw Unity Exceptions**: Unity exceptions are extremely difficult for regular users to debug as unity hides these from users. You can find information on how to check your mod using a debug build over on the [BSMG Wiki, under the modders guide](https://bsmg.wiki/modding/pc/testing.html).
3. **Low Effort Joke/Meme Mods:** Mods that exist purely as a joke are not eligible for verification. Mods that contain jokes, April Fools, or other timed event code that affect every user must be toggleable or able to be hidden within the game. [^2]  
4. **External content:** If your mod talks to any external APIs, it must be over HTTPS/TLS with no exceptions. If your mod downloads non-executable content from somewhere outside the game, that source needs to be one you own, or a well-known public API with a decent security track record. Executable content can only be downloaded from BeatMods.
5. **Asset Bundles:** Mods that loading external asset bundles should only load them by using AssetBundleLoadingTools.
6. **Compatibility:** Your mod needs to play nicely with the base game and every other approved mod on BeatMods, with exceptions to any mods that you've explicitly flagged as conflicting.  
7. **Your code is your responsibility:** AI tools are fine to use, but you need to understand what your code actually does. If someone on the approval team asks why something works a certain way, "I don't know, the AI wrote it" isn't an acceptable answer.

Mods that are found to have issues after being approved can be either removed or have their status set to unverified. 

## Mods vs Libraries
There are two types of code on BeatMods: **Plugins** and **Libraries**.

- **Plugins** are loaded by IPA or BSIPA. They run independently, and are what actually do things. They live as a single DLL which is placed in the games Plugins folder.  
- **Libraries** are the opposite. They're passive code that does nothing on their own. Libraries are used by Plugins as a dependency, living outside the Plugins folder and in the Libs folder.

**Examples:**
- Projects such as [BeatSaverSharp](https://beatmods.com/mods/101), [FFmpeg](https://beatmods.com/mods/196) and [Heck](https://beatmods.com/mods/338) are all considered Libraries.  
- [ScoreSaber](https://beatmods.com/mods/281) & [BeatLeader](https://beatmods.com/mods/268) are considered Plugins.  
- [SiraUtil](https://beatmods.com/mods/130) is a Plugin that is depended on enough to be tagged as a library.

## Verified vs Unverified
### Verified
Verified mods have been looked over by the BeatMods team and meet everything in these guidelines. They're safe, compatible with other verified mods, and are supported.

### Unverified
Unverified mods are still on the platform, but haven't been confirmed to meet the full standard. This could be because they haven't been fully reviewed yet, or because something about them fell short without being bad enough to remove.

**If your mod ends up unverified, it's likely for one of these reasons:**
- It's waiting to be fully reviewed.  
- It works, but has rough edges or bugs that keep it out of being verified.  
- It has a joke or meme element that can't be turned off, but otherwise is a real mod.  
- It has unmarked compatibility issues with other mods.

**Unverified isn't a rejection\!** Your mod is still up, available and can still be used by people. Although, it'll be clearly labelled as unverified and no support will be given. Any mod, verified or not, that crashes the game or breaks things significantly will be taken down.  


[^1]: A score tracker that doesn't save scores, or a mod that causes a full game crash on certain map types are examples of mods that would get removed.

[^2]: For example: a mod that crashes the game on a miss would not be verified under this rule, but a mod that has an option, that is disabled by default, to close the game gracefully on a miss is okay. Mods that randomly crash the game may be removed all together.

<details>
<summary>Changelog</summary>

### June 18 2026
- Revamped the guidelines for new service launch.

</details>
