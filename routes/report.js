var express = require("express");
var logger = require('../utils/logger');
var util= require('../utils/global_util.js');
var router = express.Router();

//按标签销售金额、毛利、真实毛利统计
router.post('/getTagAnalysis',function(req,res){
  if(req.session.user[0].authority_code.indexOf("99") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var sales = DB.get("Sales");
  //连接查询销售表和药品表，查出销售额和真实毛利额
  var saleDrug = "select sd.sale_money,sd.real_gross_profit,d.product_id from sales sd left join drugs d on sd.product_code = d.product_code "+
	               "where sd.delete_flag = '0' and sd.group_id = '"+req.session.user[0].group_id+"'";
  if(req.body.salesTime && req.body.salesTime.length > 1){
    var start = new Date(req.body.salesTime[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.salesTime[1]).format("yyyy-MM-dd");
    saleDrug += " and DATE_FORMAT(sd.bill_date,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(sd.bill_date,'%Y-%m-%d') <= '"+end+"'";
  }
  if(req.body.hospitalsId){
    saleDrug+="and sd.hospital_id = '"+req.body.hospitalsId+"' "
  }
  if(req.body.business){
    saleDrug+="and d.product_business = '"+req.body.business+"' "
  }
  //连接查询标签和药品表，查出所有药品包含的所有标签
  var tagDrug = "select td.drug_id,t.tag_name,t.tag_id from tag t left join tag_drug td on td.tag_id = t.tag_id "+
                "where (td.tag_drug_group_id = '"+req.session.user[0].group_id+"' or td.tag_drug_group_id is null) "+
                "and (td.tag_drug_deleta_flag = '0' or td.tag_drug_deleta_flag is null)";
  //统计数据
  var sql = "select ifnull(sum(s.sale_money),0) sm,ifnull(sum(s.real_gross_profit),0) rgp ,tdt.tag_name from "+
            "("+saleDrug+") s right join ("+tagDrug+") tdt on s.product_id = tdt.drug_id group by tdt.tag_id";

  sales.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "报表查询销售统计出错" + err);
    }
    var temp = {
      tagName:[],
      tagMoney:[],
      tagRgp:[]
    }
    for(var i = 0 ; i < result.length ;i++){
      temp.tagName.push(result[i].tag_name);
      temp.tagMoney.push(Math.round(result[i].sm*100)/100);
      temp.tagRgp.push(Math.round(result[i].rgp*100)/100);
      result[i].sm = Math.round(result[i].sm*100)/100;
      result[i].rgp = Math.round(result[i].rgp*100)/100;
    }
    res.json({"code":"000000",message:{
        imageData:temp,
        listData:result
    }});
  });
});
//查询销售记录
router.post("/getSalesMonth",function(req,res){
  if(req.session.user[0].authority_code.indexOf("99") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var sales = DB.get("Sales");
  //查询近12个月日期
  var dataSql = "select @rownum :=@rownum + 1 AS num,date_format(DATE_SUB(now(),INTERVAL @rownum MONTH),'%Y-%m') AS all_day "+
                "FROM (SELECT @rownum := -1) AS r_init,(select * from sales s limit 12) as c_init";
  //按月分组查询销售记录
  var sql = "select DATE_FORMAT(s.bill_date,'%Y-%m') bd,sum(s.sale_money) sm,sum(s.real_gross_profit) rgp from sales s "+
            "left join drugs d on s.product_code = d.product_code "+
            "where s.delete_flag ='0' and s.group_id = '"+req.session.user[0].group_id+"' ";
  if(req.body.hospitalsId){
    sql+="and s.hospital_id = '"+req.body.hospitalsId+"' "
  }
  if(req.body.business){
    sql+="and d.product_business = '"+req.body.business+"' "
  }
  sql += "group by DATE_FORMAT(s.bill_date,'%Y-%m') ";

  var s = "select t.all_day,ifnull(st.sm,0) smt,ifnull(st.rgp,0) rgpt from ("+dataSql+") t left join ("+sql+") st on st.bd = t.all_day";
  sales.executeSql(s,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "报表查询销售统计出错" + err);
    }
    var temp = {
      time:[],
      money:[],
      rgpt:[]
    }
    for(var i = 0 ; i < result.length ;i++){
      temp.time.push(result[i].all_day);
      result[i].smt = Math.round(result[i].smt*100)/100;
      temp.money.push(result[i].smt);
      result[i].rgpt = Math.round(result[i].rgpt*100)/100;
      temp.rgpt.push(result[i].rgpt);

    }
    res.json({"code":"000000",message:{
      imageData:temp,
      listData:result
    }});
  });
});
module.exports = router;
