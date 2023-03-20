import axios from 'axios';
import 'dotenv/config';
import * as Slack from '@slack/webhook';
//import * as Slack from 'typed-slack';

// Setting Pre-requisites with empty lists
let msg: any;
let pr_url_list: string[] = [];
let pr_reviewer_list: string[] = [];
let pr_reviewer_tasks: string[] = [];
let pr_cd_day_list: string[] = [];
let created_on: any = ' ';
let reviewer_names: string[] = [];
let activity_display_name: any;
let task_id: any;
let comment_created_on: any = ' ';
let comment_updated_on: any = ' ';
let diffCommentData: any = ' ';
let diffCommentDataRound: any = ' ';
let username: string = '';
let BB_WORKSPACE: string ='SOME_WORKSPACE';


// Slack API: either use the Webhook URL option from bot or use direct API for POST messages
let SLACK_WEBHOOK_URL = 'SLACK_WEBHOOK_URL'

function slack_api_call(msg: any) {
let options = {
    method: 'POST',
    url: SLACK_WEBHOOK_URL,  
    headers: {
      'Content-Type': 'application/json',
    },
    data: {text: msg}
  };
  
  axios.request(options).then(function (response) {
    console.log(response.data);
  }).catch(function (error) {
    console.error(error);
  });
}

// function api_call(msg: string | Slack.IncomingWebhookSendArguments){
//     let slack = new Slack.IncomingWebhook(SLACK_WEBHOOK_URL);
//     slack.send(msg);
//     console.log('Message sent: ' + msg);
//     }

// Get PullReq Created times
function getPRTimes(created_on: string | number | Date) {
    const currentDate: any = new Date();
    let newDate:any = new Date(created_on);

    let diffTime = currentDate - newDate;
    let diffDate = diffTime/(1000*3600*24);
    let diffDateRound = Math.round(diffDate)
    //console.log(diffDateRound);
    return diffDateRound;

}

// Get PullReq Activity (comments/tasks) times
function getCommentTimes(comment_created_on: any, comment_updated_on: any) {
    comment_created_on = new Date(comment_created_on);
    comment_updated_on = new Date(comment_updated_on);

    let diffCommentTime = comment_created_on - comment_updated_on;
    let diffCommentDate = diffCommentTime/(1000*3600*24);
    let diffCommentDateRound = Math.round(diffCommentDate)
    //console.log(diffCommentDateRound);
    return diffCommentDateRound;

}

//msg = '<!here>  yo DEVs ' + '\n';

// function newContent(reviewer_names) {
//     msg = '<!here>  yo DEVs ' + '\n';
//     msg += (size) + ' PR(s) waiting on Repo: ' +  repo + '\n';
//     msg += (response.data.values[i].title)+ ':: ' + pr_url_list[i] + '\n';
//     msg += ':fire: It was opened ' + pr_cd_day_list[i] + ' day(s) ago.\n';
//     msg += 'Reviewers::::: '+ reviewer_names + '\n';
//     console.log(msg)

// }


// Getting Repo List from BitBucket Workspace
async function getRepos(){
    const responserepos = await axios.get('https://api.bitbucket.org/2.0/repositories/' + BB_WORKSPACE+ '?limit=100' , {
    method: "GET",
    headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.BB_ACCESS_TOKEN}`

      }
    })
    const repolist: string [] = [];
    responserepos.data.values.forEach((element: any) => {
        repolist.push(element.slug);
    })
    return repolist;
}

 getRepos().then(async (repolist) => {
    

     //msg = '<!here>  yo DEVs ' + '\n';
    //console.log("msg text "+ msg);
    // get repo list and pr size    
    for (const repo of repolist) {
        //console.log(repo)
        const reponsePRStatus = await axios.get('https://api.bitbucket.org/2.0/repositories/' + BB_WORKSPACE+ '/' + repo + '/pullrequests' +'?state=OPEN' , {
            method: "GET",
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.BB_ACCESS_TOKEN}`
        
            }   
        })
 
    
    //}).then(response => {
        let size: any = reponsePRStatus.data.values.length;
        if (size > 0)
        {
            //console.log("msg repo "+ msg);
            let i: any;
            //let reviewer_names: any;
            // Get each repo's PullReqs in the workspace
            for ( i in reponsePRStatus.data.values) {
                //console.log(response.data.values[i].title);
                pr_url_list.push('https://api.bitbucket.org/2.0/repositories/' + BB_WORKSPACE+ '/' + repo + '/pullrequests/' + (reponsePRStatus.data['values'][i]['id']))
                
                 //msg += (response.data.values[i].title)+ ':: ' + pr_url_list[i] + '\n'
                //console.log("msg url "+ msg);
                created_on = (reponsePRStatus.data.values[i].created_on);
                let dateDiff: any = getPRTimes(created_on);
                pr_cd_day_list.push(dateDiff);
                // Get each repo's PullReq active reviewers
                let pr_reviewer_url = 'https://api.bitbucket.org/2.0/repositories/' + BB_WORKSPACE+ '/' + repo + '/pullrequests/' + (reponsePRStatus.data['values'][i]['id']) + '?fields=reviewers'

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
                // Get Reviewers display names and add it to list
                for (j in (responseReviewers.data.reviewers)){
                    let rev_display_name = (responseReviewers.data.reviewers[j].display_name) ;
                        if (rev_display_name != null ) {
                        //console.log(rev_display_name);
                        count += 1;
                            pr_reviewer_list.push(rev_display_name)
                        }
                        else {
                            pr_reviewer_list.push(' No Rewiewers')
                        }
                }
                reviewer_names =  Array.from(new Set(pr_reviewer_list));
                console.log("List of Reviewers: " + reviewer_names);

                // **********
                // Ignore user when there is an active task opened by them on a specific PullRequest
                
                let pr_reviewer_activity_url = 'https://api.bitbucket.org/2.0/repositories/' + BB_WORKSPACE+ '/' + repo + '/pullrequests/' + (reponsePRStatus.data['values'][i]['id']) + '/activity';
                let pr_reviewer_tasks_url = 'https://api.bitbucket.org/2.0/repositories/' + BB_WORKSPACE+ '/' + repo + '/pullrequests/' + (reponsePRStatus.data['values'][i]['id']) + '/tasks';
                    
                    let activity_options = {
                        method: 'GET',
                        url: pr_reviewer_activity_url,
                        headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${process.env.BB_ACCESS_TOKEN}`
                        }
                    };

                    const reponseActivity = await axios.request(activity_options);

                    let task_options = {
                        method: 'GET',
                        url: pr_reviewer_tasks_url,
                        headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${process.env.BB_ACCESS_TOKEN}`
                        }
                    };

                    const reponseTasks = await axios.request(task_options);
                    //console.log(reponseTasks.data.values[j]);
                    //const keys = Object.keys(reponseActivity);
                    //console.log(pr_reviewer_activity_url);
                    //console.log("before loop:  " + reviewer_names.length);
                    let k: any;
                    //console.log("K: " + k);
                    // Comments API causing issues
                    //activity_display_name = (reponseActivity.data.values[j].comment.user.display_name) ;
                    //console.log(activity_display_name);

                    
                    //console.log("before loop:  " + reviewer_names.length);
                    for ( k =0; k < reviewer_names.length; k++){
                        //console.log("K in loop: " + k);
                        //console.log("loop start:  " + reviewer_names.length);
                        //console.log(reponseActivity.data.values[j].comment.id);
                        //console.log(reponseTasks.data.values[j]);
                        if (('comment' in reponseActivity.data.values[j]) && 'id' in (reponseTasks.data.values[j])) {
                       // if (('comment' in reponseActivity.data.values[j])) {
                            activity_display_name = (reponseActivity.data.values[j].comment.user.display_name) ;
                            task_id = (reponseTasks.data.values[j]);
                            //console.log("Comment created by: " + activity_display_name);
                            if ((activity_display_name !== null && (typeof(activity_display_name) !== undefined) || (activity_display_name !== undefined))
                                || task_id !== null || ((typeof(task_id) !== undefined) || (task_id !== undefined))) {
                                comment_created_on = (reponseActivity.data.values[j].comment.created_on);
                                comment_updated_on = (reponseActivity.data.values[j].comment.updated_on);
                                //let commentDiff = getCommentTimes(comment_created_on, comment_updated_on);
                                let commentDiff = getCommentTimes(comment_updated_on, created_on);
                                //console.log("New Time: " + commentDiff);
                                //console.log("Comment created by: " + activity_display_name); 
                                if ( reviewer_names.includes(activity_display_name) && commentDiff <= 1){
                                    reviewer_names.shift();
                                    console.log("Remaining Reviewers: " + reviewer_names)
                                }             
                            }         
                        }   
                    }         
                
                    //console.log("Its diffDate: " + getCommentTimes(comment_created_on, comment_updated_on));
                    //console.log("Its them: 2 " + reviewer_names)

                // **********

                let pr_data_values  = reponsePRStatus.data.values[i];
                //msg = '<!here>  yo DEVs ' + '\n';
                msg =  'PR # '+ (pr_data_values.id) +' waiting on Repo: ' +  repo + '\n';
                msg += (pr_data_values.title)+ ':: '  + (pr_data_values.links.html.href) + '\n';
                msg += ':fire: It was opened ' + pr_cd_day_list[i] + ' day(s) ago.\n';
                
                msg += 'Reviewers:::::' + '\n';
                reviewer_names.forEach(function (each_rev_name){
                    let username = each_rev_name.replace(" ", "_").toLowerCase();
                    msg += '<@' + username + '> '
                });

                
                console.log(msg);
                //slack_api_call(msg);
                console.log("after:  " + reviewer_names.length + '\n');
            } 
       
        }
        else 
        {
            console.log("No PRs found");
        }
    slack_api_call(msg)
    console.log(msg);
        
    }
})

