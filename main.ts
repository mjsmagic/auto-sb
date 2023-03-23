import axios from 'axios';
import 'dotenv/config';
import { WebClient } from "@slack/web-api";
import csv from 'csv-parser';
import fs from 'fs';

let msg: any;
let pr_url_list: string[] = [];
let pr_reviewer_list: string[] = [];
let pr_cd_day_list: string[] = [];
let created_on: any = ' ';
let reviewer_names: string[] = [];
let BB_WORKSPACE: string = 'automation-mj';
let SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL

function slack_api_call(msg: any) {
    let options = {
        method: 'POST',
        url: SLACK_WEBHOOK_URL,
        headers: {
            'Content-Type': 'application/json',
        },
        data: { text: msg }
    };
    axios.request(options).then(function (response) {
        console.log(response.data);
    }).catch(function (error) {
        console.error(error);
    });
}

async function getEmailForUsername(username: string): Promise<string | undefined> {
    const users = [];
    await new Promise<void>((resolve, reject) => {
        fs.createReadStream('input.csv')
            .pipe(csv())
            .on('data', (row) => {
                users.push(row)
            })
            .on('error', (error) => reject(error))
            .on('end', () => resolve());
    });
    const user = users.find((u) => u["Public name"] === username);

    if (!user) {
        return undefined;
    }

    return user["Email address"];
}

function getPRTimes(created_on: string | number | Date) {
    const currentDate: any = new Date();
    let newDate: any = new Date(created_on);

    let diffTime = currentDate - newDate;
    let diffDate = diffTime / (1000 * 3600 * 24);
    let diffDateRound = Math.round(diffDate)
    //console.log(diffDateRound);
    return diffDateRound;

}

const getSlackUsers = async (reviewer_names) => {

    const reviewer_email = [];
    for (var name in reviewer_names) {
        const email = await getEmailForUsername(reviewer_names[name]);
        if (email) {
            reviewer_email.push(email);
        }
    }
    const SLACK_TOKEN = process.env.SLACK_TOKEN;
    const web = new WebClient(SLACK_TOKEN);
    try {
        // Call the users.list method of the WebClient instance to fetch all users
        const result = await web.users.list();
        // Return the array of users from the response
        const data = [];

        result.members.map((member) => {
            if (member.profile.email && member.name && reviewer_email.includes(member.profile.email)) {
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

async function getRepos() {
    try {
        const responserepos = await axios.get('https://api.bitbucket.org/2.0/repositories/' + BB_WORKSPACE + '?limit=100', {
            method: "GET",
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.BB_ACCESS_TOKEN}`

            }
        })
        const repolist: string[] = [];
        responserepos.data.values.forEach((element: any) => {
            repolist.push(element.slug);
        })
        return repolist;
    } catch (error) {
        console.log(error);
        console.log("Unable to get repos");
        return [];
    }
}

getRepos().then(async (repolist) => {
    for (const repo of repolist) {
        const reponsePRStatus = await axios.get('https://api.bitbucket.org/2.0/repositories/' + BB_WORKSPACE + '/' + repo + '/pullrequests' + '?state=OPEN', {
            method: "GET",
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.BB_ACCESS_TOKEN}`

            }
        })

        let size: any = reponsePRStatus.data.values.length;
        if (size > 0) {
            let i: any;
            for (i in reponsePRStatus.data.values) {
                pr_url_list.push('https://api.bitbucket.org/2.0/repositories/' + BB_WORKSPACE + '/' + repo + '/pullrequests/' + (reponsePRStatus.data['values'][i]['id']))
                created_on = (reponsePRStatus.data.values[i].created_on);
                let dateDiff: any = getPRTimes(created_on);
                pr_cd_day_list.push(dateDiff);
                let pr_reviewer_url = 'https://api.bitbucket.org/2.0/repositories/' + BB_WORKSPACE + '/' + repo + '/pullrequests/' + (reponsePRStatus.data['values'][i]['id']) + '?fields=reviewers'
                let options = {
                    method: 'GET',
                    url: pr_reviewer_url,
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${process.env.BB_ACCESS_TOKEN}`
                    }
                };
                const responseReviewers = await axios.request(options);
                let count = 0;
                let j: any;
                for (j in (responseReviewers.data.reviewers)) {
                    let rev_display_name = (responseReviewers.data.reviewers[j].display_name);
                    if (rev_display_name != null) {
                        count += 1;
                        pr_reviewer_list.push(rev_display_name)
                    }
                    else {
                        pr_reviewer_list.push(' No Rewiewers')
                    }
                }
                reviewer_names = Array.from(new Set(pr_reviewer_list));

                const comments = await fetchComments('https://api.bitbucket.org/2.0/repositories/' + BB_WORKSPACE + '/' + repo + '/pullrequests/' + (reponsePRStatus.data['values'][i]['id']) + '/comments', process.env.BB_ACCESS_TOKEN);
                for (var l = 0; l < comments.length; l++) {
                    var OneDay = new Date().getTime() + (1 * 24 * 60 * 60 * 1000);
                    if (new Date(comments[l].updated_on).getTime() <= OneDay) {
                        const index = reviewer_names.indexOf(comments[l].user.display_name);
                        if (index > -1) {
                            reviewer_names.splice(index, 1);// only splice array when item is found
                        }
                    }
                }
                const tasks = await fetchTask('https://api.bitbucket.org/2.0/repositories/' + BB_WORKSPACE + '/' + repo + '/pullrequests/' + (reponsePRStatus.data['values'][i]['id']) + '/tasks', process.env.BB_ACCESS_TOKEN,);
                for (var l = 0; l < tasks.length; l++) {
                    var OneDay = new Date().getTime() + (1 * 24 * 60 * 60 * 1000);
                    if (new Date(tasks[l].updated_on).getTime() <= OneDay) {
                        const index = reviewer_names.indexOf(tasks[l].creator.display_name);
                        if (index > -1) {
                            reviewer_names.splice(index, 1);// only splice array when item is found
                        }
                    }
                }
                console.log(reviewer_names);
                if (reviewer_names.length == 0) {
                    continue;
                }
                const slackReviewer = await getSlackUsers(reviewer_names);
                let pr_data_values = reponsePRStatus.data.values[i];

                msg = `*PR # ${pr_data_values.id} Waiting on Repository name: ${repo}*` + '\n';
                msg += 'It was opened ' + pr_cd_day_list[i] + ' day(s) ago. :fire: \n';
                msg += '\n';
                msg += `*Title* : ${(pr_data_values.title)}` + '\n';
                msg += `*Link* : ${pr_data_values.links.html.href}` + '\n';
                msg += '\n';
                msg += '*Reviewers*' + '\n';
                slackReviewer.forEach(function (memberId) {
                    msg += '<@' + memberId + '> '
                });
                console.log("after:  " + reviewer_names.length + '\n');
                slack_api_call(msg);
            }
        }
        else {
            console.log("No PRs found");
        }
    }
})

