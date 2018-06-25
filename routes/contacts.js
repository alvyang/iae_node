var express = require("express");
var router = express.Router();

//新增联系人
router.post("/saveContacts",function(req,res){
  if(req.session.user[0].authority_code.indexOf("46") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var contacts = DB.get("Contacts");
  req.body.group_id = req.session.user[0].group_id;
  contacts.insertIncrement(req.body,function(err,result){
    res.json({"code":"000000",message:result});
  });
});
//编辑联系人
router.post("/editContacts",function(req,res){
  if(req.session.user[0].authority_code.indexOf("47") > -1){
    var contacts = DB.get("Contacts");
  	req.body.group_id = req.session.user[0].group_id;
    contacts.update(req.body,'contacts_id',function(err,result){
      res.json({"code":"000000",message:null});
    });
  }else{
    res.json({"code":"111112",message:"无权限"});
  }
});
//删除联系人
router.post("/deleteContacts",function(req,res){
  if(req.session.user[0].authority_code.indexOf("48") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var contacts = DB.get("Contacts");
  req.body.delete_flag = 1;
  contacts.update(req.body,'contacts_id',function(err,result){

    res.json({"code":"000000",message:null});
  });
});
//获取联系人列表
router.post("/getContacts",function(req,res){
  var contacts = DB.get("Contacts");
  var sql = "select * from contacts c where c.delete_flag = '0' and c.group_id = '"+req.session.user[0].group_id+"'";
  if(req.body.data.contacts_name){
    sql += " and c.contacts_name like '%"+req.body.data.contacts_name+"%'";
  }
  contacts.countBySql(sql,function(err,result){
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql += " order by c.contacts_id desc limit " + req.body.page.start + "," + req.body.page.limit + "";
    contacts.executeSql(sql,function(err,result){
      req.body.page.data = result;
      res.json({"code":"000000",message:req.body.page});
    });
  });
});
//获取联系人列表
router.post("/getAllContacts",function(req,res){
  var contacts = DB.get("Contacts");
  req.body.group_id = req.session.user[0].group_id;
  req.body.delete_flag = 0;
  contacts.where(req.body,function(err,result){
    res.json({"code":"000000",message:result});
  });
});
module.exports = router;