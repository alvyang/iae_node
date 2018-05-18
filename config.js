var app = {
    email:'626183528@qq.com',
    appport: 3000,
    host: 'localhost',
    port: '3306',
    user: 'root',
    password: 'admin',
    database: 'jfinalshop',
    logger_path: "./log/error.log",
    logger_level: 'debug' //debug | error
};

global.Sys =new function(){
    var me=this;
    this.cont={},
    //权限认证
    this.permissionUrls= ["/inter"]
    //管理员权限
    this.adminUrls=[]
};

module.exports = app;
