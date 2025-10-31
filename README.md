# BadModelSaber
A asset hosting platform for Beat Saber.

## Preparing the server
To run the server, you must have a instance of PostgreSQL & a database ready for the server to use. If you do not provide Discord OAuth2 credentials, the server will disable authentication and will not allow sign-ins. The importer also requires a Discord bot token in order to make API requests to get users when running the ModelSaber importer.
### Running with Docker
1. Pull the frontend and backend images.
2. Look at the `docker-compose.example.yml` file for an example of how to set up the server with Docker Compose.
3. Copy the `docker-compose.example.yml` file to `docker-compose.yml` and fill in the environment variables.
4. Run `docker-compose up -d` to start the server.
### Setting up the server locally
1. Clone the repository.
2. Navigate to the `backend` folder.
3. Install the dependencies using `yarn`.
4. Copy the `.default.env` file to `.env` and fill in the environment variables.
5. Navigate to the `frontend` folder.
6. Install the dependencies using `yarn`.
7. Copy the `.default.env` file to `.env`.
## Data Storage
The backend server stores all of its data in a folder called `storage`. If you are using docker, this folder is located at `/app/storage`. If you are running the server locally, it is located in the root directory of the backend folder (same folder that `build` & `src` are).