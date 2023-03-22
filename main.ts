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
    const user = users.find((u) => u.username === username);

    if (!user) {
        return undefined;
    }

    return user.email;
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
    const SLACK_TOKEN =
        process.env.SLACK_TOKEN;
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

const fetchComments = async (apiUrl: string, accessToken: string, reviewerUsernames: any) => {
    try {
        var OneDay = new Date().getTime() + (1 * 24 * 60 * 60 * 1000);
        const response = await axios.get(apiUrl, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
        const comments = response.data.values;
        const recentComments = comments.filter(
            (comment) => new Date(comment.created_on).getTime() <= OneDay
        );
        const filteredComments = recentComments.filter(
            (comment) => !reviewerUsernames.includes(comment.user.username)
        );
        return filteredComments;
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

                const comments = await fetchComments('https://api.bitbucket.org/2.0/repositories/' + BB_WORKSPACE + '/' + repo + '/pullrequests/' + (reponsePRStatus.data['values'][i]['id']) + '/comments', process.env.BB_ACCESS_TOKEN, reviewer_names);
                const slackReviewer = await getSlackUsers(reviewer_names);
                var commenti = 1
                msg = 'Comments:::::' + '\n';
                comments.forEach((comment) => {
                    msg += `${commenti}` + '\n';
                    msg += `${comment.content.raw}` + '\n';
                    msg += `Comment By : ${comment.user.display_name}` + '\n';
                    msg += `PR Title : ${comment.pullrequest.title}` + '\n';
                    msg += '\n';
                    msg += '\n';
                    commenti = commenti + 1;
                })

                let pr_data_values = reponsePRStatus.data.values[i];
                //msg = '<!here>  yo DEVs ' + '\n';
                msg += 'PR # ' + (pr_data_values.id) + ' waiting on Repo: ' + repo + '\n';
                msg += (pr_data_values.title) + ':: ' + (pr_data_values.links.html.href) + '\n';
                msg += ':fire: It was opened ' + pr_cd_day_list[i] + ' day(s) ago.\n';

                msg += 'Reviewers:::::' + '\n';
                slackReviewer.forEach(function (memberId) {
                    msg += '<@' + memberId + '> '
                });
                console.log("after:  " + reviewer_names.length + '\n');
            }
            slack_api_call(msg);
        }
        else {
            console.log("No PRs found");
        }
    }
})

