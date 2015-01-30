#!/bin/bash
npm install
sudo service postgresql start
sudo apt-get install postgresql-contrib-9.3 uuid
# set password
echo Set the root password for the postgres instance...
echo '\password' | sudo sudo -u postgres psql
./create-database.sh
