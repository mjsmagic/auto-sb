import axios from "axios";
import fs from "fs";
import csv2json = require("csvtojson");
import { WebClient } from "@slack/web-api";
import 'dotenv/config';

let emailList: any[] = [];
let emailIDs: any[] = [];
let emailID: any;
let myNames: string;
let filtered: any;
const userList: string[] = [];
let users: any[];

interface User {
  name: string;
  email: string;
}

// convert users.csv file to JSON array
// Get all users from BitBucket CSV to find their usernames and email addresses
async function getBitBucketEmails() {
  try {
    // get json output of downloaded CSV list
    users = await csv2json().fromFile("input.csv");
    // Rename CSV column names to JSON object keys such as "Public name": name
    const changeStrings = users.map(
      ({ "Public name": name, "Email address": email, ...rest }) => ({
        name,
        email,
        ...rest,
      })
    );
    //console.log(flat);
    // get array object of BB username and email (needs this format to compare againt slack user details)
    filtered = changeStrings.map(({ name, email }: User) => ({ name, email }));
    //console.log(filtered);
  } catch (err) {
    console.log(err);
  }
  console.log(filtered);

  return filtered;
}
//getBitBucketEmails();

// Get all users from Slack to find their usernames and email addresses
async function getSlackEmails() {
  //: Promise<string[]>{
  let url = "https://app.slack.com/api/users.list";

  let options = {
    method: "GET",
    url: url,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${process.env.SLACK_TOKEN}`,
    },
  };
  console.log(options);
  // const responseProfiles = await axios.request(options).then(function (res) {
  const responseProfiles = await axios.request(options);
  //console.log(responseProfiles.data);
  let j: any;
  let count = 0;
  let target: any = {};
  for (j in responseProfiles.data.members) {
    //console.log(responseProfiles.data.members[j].name);
    let rev_display_name = responseProfiles.data.members[j].name;
    let rev_email = responseProfiles.data.members[j].profile.email;

    if (rev_display_name != null && rev_email != null) {
      //console.log(rev_display_name);
      count += 1;
      //userList.push(rev_email)
      userList.push(
        "{ name: '" + rev_display_name + "' , email: '" + rev_email + "' }"
      );
      //target = Object.assign({},...userList.map(key => ({[key]: rev_display_name})));
    }
    // else {
    //     userList.push(' No Rewiewers')
    // }
  }
  let updatedList: any = JSON.stringify(userList);
  //console.log(updatedList.replace(/"/g, ""));
  //console.log(userList);
  //updatedList = Object.entries(updatedList).map(([name, email]) => `${name}: ${email}`);
  //console.log(updatedList);
  return updatedList;
}
//getSlackEmails();

// Find if there is any match between emails and then get their slack username to send @mention on the slack channel.
// This not a working fucntion
async function findMatchEmails() {
  let bitb = await getBitBucketEmails();
  let slack = await getSlackEmails();

  console.log(slack);
  for (let i = 0; i < slack.length; i++) {
    console.log("MeI");
    for (let j = 0; j < bitb.length; j++) {
      console.log("MeJ");
      if (slack[i].name === bitb[j].name) {
        console.log(slack[i].name);
      }
    }
  }
}

// findMatchEmails();

const getSlackUsers = async () => {
  const SLACK_TOKEN =
    "xoxb-2087098036294-4977504131303-cV7hMzK0fdjafUULXud3IYOb";
  const web = new WebClient(SLACK_TOKEN);

  try {
    // Call the users.list method of the WebClient instance to fetch all users
    const result = await web.users.list();
    // Return the array of users from the response
    const emails = [];
    result.members.map((member) => {
      if (member.profile.email && member.name) {
        emails.push({ email: member.profile.email, name: member.name });
      }
    });
    return emails;
  } catch (error) {
    console.error(error);
    return [];
  }
};
