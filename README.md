# BadModelSaber

A asset hosting platform for Beat Saber.

## Running the server
To run the server, you must have a instance of PostgreSQL & a database ready for the server to use. If you do not provide Discord OAuth2 credentials, the server will disable authentication and will not allow sign-ins.
1. Clone the repository.
2. Run `yarn` to install dependencies.
3. Create a `.env` file in the root directory. Environment vairables are available in `.default.env`.
4. Run `yarn dev` to build and start the server.

The server stores all of its data in a folder called `storage`. If you are using docker, this folder is located at `/app/storage`. If you are running the server locally, it is located in the root directory of the repository.