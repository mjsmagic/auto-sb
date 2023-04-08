import axios from "axios";
import "dotenv/config";
import { WebClient } from "@slack/web-api";
import csv from "csv-parser";
import fs from "fs";

let msg: any;
let pr_url_list: string[] = [];
let pr_cd_day_list: string[] = [];
let created_on: any = " ";
let BB_WORKSPACE: string = "automation-mj";
let SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const SLACK_TOKEN = process.env.SLACK_TOKEN;
const web = new WebClient(SLACK_TOKEN);

async function slack_api_call(msg: any, memberId: string) {
  try {
    const data = await web.chat.postMessage({
      channel: memberId,
      text: msg,
    });
    if (data.ok) {
      console.log(`Slack message Send to ${memberId}`);
      return;
    }
    console.log(`Unable to send slack message`);
    return;
  } catch (error) {
    console.log(`Unable to send slack message error ${error}`);
  }
}

async function getEmailForUsername(
  accountId: string
): Promise<string | undefined> {
  let config = {
    method: "get",
    maxBodyLength: Infinity,
    url: `${process.env.COMPANY_BITBUCKET_URL}?accountId=${accountId}`,
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${process.env.BB_COMPANY_ACCESS_TOKEN}`,
    },
  };

  try {
    const response = await axios.request(config);
    return response.data.emailAddress;
  } catch (error) {
    console.log(`Error getting Email for AccountID Error: ${error.message}`);
  }
}

function getPRTimes(created_on: string | number | Date) {
  const currentDate: any = new Date();
  let newDate: any = new Date(created_on);

  let diffTime = currentDate - newDate;
  let diffDate = diffTime / (1000 * 3600 * 24);
  let diffDateRound = Math.round(diffDate);
  //console.log(diffDateRound);
  return diffDateRound;
}

const getSlackUsers = async (reviewer) => {
  const reviewer_email = [];
  for (var i in reviewer) {
    const email = await getEmailForUsername(reviewer[i]);
    if (email) {
      reviewer_email.push(email);
    }
  }
  try {
    const result = await web.users.list();
    const data = [];
    result.members.map((member) => {
      if (
        member.profile.email &&
        member.name &&
        reviewer_email.includes(member.profile.email)
      ) {
        data.push(member.id);
      }
    });
    return data;
  } catch (error) {
    console.error(error);
    return [];
  }
};

const fetchComments = async (apiUrl: string, accessToken: string) => {
  try {
    const response = await axios.get(apiUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data.values;
  } catch (error) {
    console.error(error);
  }
};

const fetchTask = async (apiUrl: string, accessToken: string) => {
  try {
    const response = await axios.get(apiUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data.values;
  } catch (error) {
    console.error(error);
  }
};

const fetchApprovals = async (repo, id) => {
  let pr_reviewer_url =
    "https://api.bitbucket.org/2.0/repositories/" +
    BB_WORKSPACE +
    "/" +
    repo +
    "/pullrequests/" +
    id;
  let options = {
    method: "GET",
    url: pr_reviewer_url,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.BB_ACCESS_TOKEN}`,
    },
  };

  try {
    const response = await axios.request(options);
    const approvals = response.data.participants.filter(
      (participant) => participant.approved
    );
    return approvals.map((approval) => approval.user.display_name);
  } catch (error) {
    console.log(`Error fetching approvals Error: ${error}`);
  }
};

async function getRepos() {
  try {
    const responserepos = await axios.get(
      "https://api.bitbucket.org/2.0/repositories/" +
        BB_WORKSPACE +
        "?limit=100",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.BB_ACCESS_TOKEN}`,
        },
      }
    );
    const repolist: string[] = [];
    responserepos.data.values.forEach((element: any) => {
      repolist.push(element.slug);
    });
    return repolist;
  } catch (error) {
    console.log(error);
    console.log("Unable to get repos");
    return [];
  }
}

getRepos().then(async (repolist) => {
  for (const repo of repolist) {
    const reponsePRStatus = await axios.get(
      "https://api.bitbucket.org/2.0/repositories/" +
        BB_WORKSPACE +
        "/" +
        repo +
        "/pullrequests" +
        "?state=OPEN",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.BB_ACCESS_TOKEN}`,
        },
      }
    );

    let size: any = reponsePRStatus.data.values.length;
    if (size > 0) {
      let i: any;
      for (i in reponsePRStatus.data.values) {
        pr_url_list.push(
          "https://api.bitbucket.org/2.0/repositories/" +
            BB_WORKSPACE +
            "/" +
            repo +
            "/pullrequests/" +
            reponsePRStatus.data["values"][i]["id"]
        );
        created_on = reponsePRStatus.data.values[i].created_on;
        let dateDiff: any = getPRTimes(created_on);
        pr_cd_day_list.push(dateDiff);
        let pr_reviewer_url =
          "https://api.bitbucket.org/2.0/repositories/" +
          BB_WORKSPACE +
          "/" +
          repo +
          "/pullrequests/" +
          reponsePRStatus.data["values"][i]["id"] +
          "?fields=reviewers";
        let options = {
          method: "GET",
          url: pr_reviewer_url,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.BB_ACCESS_TOKEN}`,
          },
        };
        const responseReviewers = await axios.request(options);

        let reviewers = [...responseReviewers.data.reviewers];
        console.log(reviewers);

        const comments = await fetchComments(
          "https://api.bitbucket.org/2.0/repositories/" +
            BB_WORKSPACE +
            "/" +
            repo +
            "/pullrequests/" +
            reponsePRStatus.data["values"][i]["id"] +
            "/comments",
          process.env.BB_ACCESS_TOKEN
        );

        for (var l = 0; l < comments.length; l++) {
          var OneDay =
            new Date(comments[l].updated_on).getTime() +
            1 * 24 * 60 * 60 * 1000;
          if (new Date().getTime() >= OneDay) {
            reviewers = reviewers.filter((data) => {
              return data.display_name != comments[l].user.display_name;
            });
          }
        }

        const tasks = await fetchTask(
          "https://api.bitbucket.org/2.0/repositories/" +
            BB_WORKSPACE +
            "/" +
            repo +
            "/pullrequests/" +
            reponsePRStatus.data["values"][i]["id"] +
            "/tasks",
          process.env.BB_ACCESS_TOKEN
        );

        for (var l = 0; l < tasks.length; l++) {
          var OneDay =
            new Date(tasks[l].updated_on).getTime() + 1 * 24 * 60 * 60 * 1000;
          if (new Date().getTime() >= OneDay) {
            reviewers = reviewers.filter((data) => {
              console.log(tasks[l].creator);
              return data.display_name != tasks[l].creator.display_name;
            });
          }
        }

        const approvals = await fetchApprovals(
          repo,
          reponsePRStatus.data["values"][i]["id"]
        );
        for (var l = 0; l < approvals.length; l++) {
            reviewers = reviewers.filter((data) => {
              return data.display_name != approvals[l];
            });
        }

        let pr_data_values = reponsePRStatus.data.values[i];
        if (reviewers.length == 0) {
          console.log(
            `No Reviewer to notify for PR # ${pr_data_values.id} and Repo : ${repo}`
          );
          continue;
        }
        const slackReviewer = await getSlackUsers(
          reviewers.map((obj) => obj.account_id)
        );
        msg =
          `*PR # ${pr_data_values.id} Waiting on Repository name: ${repo}*` +
          "\n";
        msg += "It was opened " + pr_cd_day_list[i] + " day(s) ago. :fire: \n";
        msg += "\n";
        msg += `*Title* : ${pr_data_values.title}` + "\n";
        msg += `*Link* : ${pr_data_values.links.html.href}` + "\n";
        msg += "\n";
        slackReviewer.forEach(function (memberId) {
          slack_api_call(msg, memberId);
        });
      }
    } else {
      console.log("No PRs found");
    }
  }
});
