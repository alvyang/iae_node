var express = require("express");
var logger = require('../utils/logger');
var util = require('../utils/global_util');
var router = express.Router();

//验证标签是否存在
router.post("/exitsTag",function(req,res){
  var tag = DB.get("Tag");
  req.body.tag_group_id = req.session.user[0].group_id;
  req.body.tag_delete_flag = '0';
  tag.where(req.body,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "验证标签是否存在出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
//新增标签
router.post("/saveTag",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",97,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var tag = DB.get("Tag");
  req.body.tag_group_id = req.session.user[0].group_id;
  req.body.tag_create_userid = req.session.user[0].id;
  req.body.tag_create_time = new Date();
  tag.insert(req.body,'tag_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "新增标签出错" + err);
    }
    var message = req.session.user[0].realname+"新增标签。id："+result;
    util.saveLogs(req.session.user[0].group_id,"-",JSON.stringify(req.body),message);
    res.json({"code":"000000",message:result});
  });
});
//编辑标签
router.post("/editTag",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",95,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var tag = DB.get("Tag");
  req.body.tag_group_id = req.session.user[0].group_id;
  delete req.body.tag_create_time;
  var front_message = req.body.front_message;
  tag.update(req.body,'tag_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "修改标签出错" + err);
    }
    var message = req.session.user[0].realname+"修改标签。";
    util.saveLogs(req.session.user[0].group_id,front_message,JSON.stringify(req.body),message);
    res.json({"code":"000000",message:null});
  });
});
//删除标签
router.post("/deleteTag",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",96,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var tag = DB.get("Tag");
  req.body.tag_delete_flag = 1;
  tag.update(req.body,'tag_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "删除标签出错" + err);
    }
    var message = req.session.user[0].realname+"删除标签。id："+req.body.tag_id;
    util.saveLogs(req.session.user[0].group_id,"-","-",message);
    res.json({"code":"000000",message:null});
  });
});
//获取标签列表
router.post("/getTags",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",94,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var tag = DB.get("Tag");
  var sql = "select * from tag t where t.tag_delete_flag = '0' and t.tag_group_id = '"+req.session.user[0].group_id+"'";
  if(!util.isEmpty(req.body.data.tag_name)){
    sql += " and t.tag_name like '%"+req.body.data.tag_name+"%'";
  }
  if(!util.isEmpty(req.body.data.tag_type)){
    sql += " and t.tag_type = '"+req.body.data.tag_type+"'";
  }
  var tagNumSql = "select td.tag_id,count(*) tqn from tag_drug td "+
                  "where td.tag_drug_deleta_flag = '0' and td.tag_drug_group_id = '"+req.session.user[0].group_id+"' "+
                  "group by td.tag_id";
  sql = "select tn.*,ifnull(num.tqn,0) tag_quote_num from ("+sql+") tn left join ("+tagNumSql+") num on tn.tag_id = num.tag_id";
  tag.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询标签人，查询总数出错" + err);
    }
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql += " order by tn.tag_create_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
    tag.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "查询标签人出错" + err);
      }
      req.body.page.data = result;
      res.json({"code":"000000",message:req.body.page});
    });
  });
});
//获取标签列表
router.post("/getAllTags",function(req,res){
  var tag = DB.get("Tag");
  req.body.tag_group_id = req.session.user[0].group_id;
  req.body.tag_delete_flag = '0';
  var tagIds = req.body.tag_ids?req.body.tag_ids.split(","):[];
  delete req.body.tag_ids;
  tag.where(req.body,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询标签人，查询所有联系出错" + err);
    }
    var tag=[];
    for(var i = 0 ; i < result.length ;i++){
      for(var j = 0 ; j < tagIds.length ; j++){
        if(result[i].tag_id == tagIds[j]){
          result[i].disabled = true;
          tag.push(result[i].tag_name);
        }
      }
    }
    var tagAll=[{label:'医院科室',value:'1',children:[]},
                {label:'药品分类',value:'2',children:[]},
                {label:'运营方式',value:'0',children:[]},
                {label:'其它',value:'3',children:[]}];
    for(var i = 0 ; i < result.length ;i++){
      for(var j = 0 ; j < tagAll.length;j++){
        if(tagAll[j].value == result[i].tag_type){
          tagAll[j].children.push({
            label:result[i].tag_name,
            value:result[i].tag_id,
            disabled:result[i].disabled,
          });
        }
      }
    }
    res.json({"code":"000000",message:{
      tag:tag,
      tagAll:tagAll
    }});
  });
});
module.exports = router;
