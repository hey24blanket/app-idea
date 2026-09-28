const handler=require('./vault.js');
module.exports=(req,res)=>{req.query={...req.query,action:'cron'};return handler(req,res);};
