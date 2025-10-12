const mongoose = require('mongoose');

main().then(res => console.log("db connected successfully..!!"))
main().catch(err => console.log("db not connected...!!!", err));


async function main() {
  await mongoose.connect("mongodb+srv://thehitansh_db_user:2eZgxdYLtOQrMc2T@cluster0.c0sei96.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0");
  console.log("db connected successfully..!!");
}