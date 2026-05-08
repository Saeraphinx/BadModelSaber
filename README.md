# BadModelSaber
A asset & mod hosting platform for Beat Saber.

## Preparing the server
To run the server, you must have a instance of PostgreSQL & a database ready for the server to use. If you do not provide Discord OAuth2 credentials, the server will disable authentication and will not allow sign-ins. The importer also requires a Discord bot token in order to make API requests to get users when running the ModelSaber importer. This bot token will also be used to attempt to notify users when they receive an alert, so it is recommended to provide a bot token even if you do not plan on using the importer. GitHub OAuth2 credentials are not required, but the frontend will still show the option to sign in with GitHub, and if you do not provide credentials, users who attempt to sign in with GitHub will receive an error.
### Running with Docker
1. Pull the frontend and backend images.
2. Look at the `docker-compose.example.yml` file for an example of how to set up the server with Docker Compose.
3. Copy the `docker-compose.example.yml` file to `docker-compose.yml` and fill in the environment variables.
4. Run `docker-compose up -d` to start the server.
### Setting up the server locally
Both the frontend and backend use `yarn` as their package manager. You can start both by running `yarn dev` in their respective folders.
1. Clone the repository.
2. Navigate to the `backend` folder.
3. Install the dependencies using `yarn`.
4. Copy the `.default.env` file to `.env` and fill in the environment variables.
5. Navigate to the `frontend` folder.
6. Install the dependencies using `yarn`.
7. Copy the `.default.env` file to `.env`.
## Data Storage
The backend server stores all of its data in a folder called `storage`. If you are using docker, this folder is located at `/app/storage`. If you are running the server locally, it is located in the root directory of the backend folder (same folder that `build` & `src` are).
The folder structure for assets is as follows:
```
storage/
├── uploads/
│   ├── {id}
│   │   ├── {...files}
```
The `uploads` folder contains all of the uploaded files. Each upload is stored in a folder named after the upload's ID. Inside each upload folder are the files associated with that upload.
Common files will be:
### Assets
Assets will have both the asset file and up to 5 images in the same folder. The asset file will be named using the `fileSafeName` property of the asset, and the images will be named according to the `iconNames` property of the asset. For example, if asset ID 123 has a `fileSafeName` of `example`, a type of `sound_ogg` and `iconNames` of `["icon1.png", "icon2.png"]`, the folder for that asset will look like this:
```
storage/
├── uploads/
│   ├── 123/
│   │   ├── example.ogg
│   │   ├── icon1.png
│   │   ├── icon2.png
```
### Mods
Versions of projects will have a similar structure, but the files will be named according to the `name` property of the project and the `version` & `platform` property of the version, as well as being in a sub folder dedicated to that version. For example, if project ID 456 had version ID 532 with a `name` of `Example Mod` and a `version` of `1.0.0` and `platform` of `universal`, the folder for that version will look like this:

```
storage/
├── uploads/
│   ├── 456/
|   |   ├── {project.iconFileName}
|   |   ├── 532/
│   │   |   ├── Example Mod_universal_v1.0.0.zip
|   |   |   ├── Example Mod_universal_v1.0.0_manifest.json
|   |   |   ├── Example Mod_universal_v1.0.0.dll (if the version has been decompiled already)
|   |   |   ├── decompiled/
|   |   |   |   ├── {...decompiled files}
```


## Translations
The frontend uses Inlang/Paraglide for translations. All translation files are located in `frontend/src/lib/paraglide/messages/`. Translations are built when running `yarn install` in the frontend folder, but you can also run `yarn i18n` to rebuild them. 
:::note
The frontend does not know what translations it has available, so if you add a new translation, you must also add it to the `availableLocales` array in `frontend/src/lib/stylizer.ts`.


The backend uses a custom translation system for user generated content. Errors and alerts generated do not have support for translations. Backend system is based on [frto027's PR to BadBeatMods](https://github.com/Saeraphinx/BadBeatMods/pull/91).

## Tests
The backend uses Vitest for testing. Test files are located in the `test` folder. You can run the tests by executing `yarn test` in the backend folder. Docker is required for running the tests as it relies on a PostgreSQL container.
