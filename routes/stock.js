var express = require("express");
var util= require('../utils/global_util.js');
var logger = require('../utils/logger');
var router = express.Router();

//编辑菜单
router.post("/editStock",function(req,res){
  // if(req.session.user[0].authority_code.indexOf("63") < 0){
  //   res.json({"code":"111112",message:"无权限"});
  //   return ;
  // }
  var drugs = DB.get("Drugs");
  drugs.update(req.body,'product_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "修改库存出错" + err);
    }
    res.json({"code":"000000",message:null});
  });
});

//分组查询，获取备注
router.post("/getStockAnalysis",function(req,res){
  var drug = DB.get("Drugs");
  var month = util.getSixMonth();
  // var sql = "select p.remark from purchase p where p.delete_flag = '0' and p.group_id = '"+req.session.user[0].group_id+"' and p.remark is not null and p.remark !='' group by p.remark"
  var productCode = req.body.productCode;
  var productId = req.body.productId;
  //销售统计sql
  var sql = "select sum(s.sale_num) as num,DATE_FORMAT(s.bill_date,'%Y-%m') as time from sales s where s.delete_flag = '0' and s.group_id = '"+req.session.user[0].group_id+"'";
  sql += " and s.product_code = '"+productCode+"'";
  sql += " group by DATE_FORMAT(s.bill_date,'%Y-%m') desc"
  //调货统计sql
  var allotSql = "select sum(a.allot_number) as anum,DATE_FORMAT(a.allot_time,'%Y-%m') as time from allot a where a.allot_delete_flag = '0' and a.allot_group_id = '"+req.session.user[0].group_id+"'";
  allotSql += " and a.allot_drug_id = '"+productId+"'";
  allotSql += " group by DATE_FORMAT(a.allot_time,'%Y-%m') desc"
  drug.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "统计库存，销售统计出错" + err);
    }
    drug.executeSql(allotSql,function(err,allot){
      if(err){
        logger.error(req.session.user[0].realname + "统计库存，调货统计出错" + err);
      }
      var num = [];
      var anum = [];
      for(var i = 0 ; i < month.length ;i++){
        for(var j = 0 ; j < result.length;j++){
          if(month[i] == result[j].time){
            num[i]=result[j].num;
          }
        }
        if(!num[i]){
          num[i]=0;
        }
        for(var j = 0 ; j < allot.length;j++){
          if(month[i] == allot[j].time){
            anum[i]=allot[j].anum;
          }
        }
        if(!anum[i]){
          anum[i]=0;
        }
      }
      var data = {time:month,num:num,anum:anum}
      res.json({"code":"000000",message:data});
    });
  });
});
module.exports = router;
