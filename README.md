## Typescript Interview Test

1. Install postgres & nodejs
2. Create the test database using the `./createdb.sh` script
3. Install the `npm_modules` for this project running `npm install`

To add a favourite language to the DB, pass the name of the github user and the language via the cli as `USER_NAME` & `LANGUAGE`
Eg
`USER_NAME=gaearon LANGUAGE=french npm run test`

To retrieve a user's favourite languages, pass the name of the github user via the cli as `USER_NAME`
Eg
`USER_NAME=gaearon npm run test`

To retrieve users based on some criteria, pass the name of the field you want to filter on and value via the cli as `FILTERS`
Eg
`FILTERS=location:lisbon npm run test`