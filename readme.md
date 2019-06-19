# Cloud Cache GFSH app
Logging into Cloud Cache requires a number of steps to login to the gfsh console.   This app is designed to eliminate those steps altogether.    Once installed all you need to do is open the application URL in your browser and you will be logged into your Cloud Cache instance.

If you need the gfsh command referance it is here:
http://gemfire.docs.pivotal.io/98/gemfire/tools_modules/gfsh/chapter_overview.html

## How to deploy

1. Clone the repo corresponding to your PCC instance - check out branches.
2. `npm install`
3. `cf push`
4. Put your IP in the allowed list `cf set-env cloudcache-gfsh-app allowed_addresses '["42.42.42.42"]'`
 * If your don't know google does:   https://www.google.com/search?q=whats+my+ip
5. Redeploy `cf restage cloudcache-gfsh-app`
6. Open the URL for your application


## Other tricks
Once you are done with `gfsh` you can just exit and you will have a `bash` prompt.   

## Other interestings

On first invocation the app will download and install java and `gfsh`.   You can watch the script doing its job.  Subsequent invocations will just reuse those bits.

If the computer you are using isn't in the allowed addresses list you will get a black screen with no text.    

There seems to be something up with Node 12 and one of the dependant libraries.    So you should use Node version 11 or older.

Example commands to switch node version.
```bash
nvm install 10.16.0
rm -rf node_modules
npm install
```
