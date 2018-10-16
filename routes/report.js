var express = require("express");
var logger = require('../utils/logger');
var util= require('../utils/global_util.js');
var router = express.Router();

//查询销售按真实毛利率
router.post("/getSalesByProfitRate",function(req,res){
  if(req.session.user[0].authority_code.indexOf("99") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var sql = "select s.* from sales s left join drugs d "+
            "on s.product_code = d.product_code where s.delete_flag='0' and s.group_id = '"+req.session.user[0].group_id+"' "+
            "and d.delete_flag='0' and d.group_id = '"+req.session.user[0].group_id+"' ";
  if(req.body.salesTime && req.body.salesTime.length > 1){
    var start = new Date(req.body.salesTime[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.salesTime[1]).format("yyyy-MM-dd");
    sql += " and DATE_FORMAT(s.bill_date,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(s.bill_date,'%Y-%m-%d') <= '"+end+"'";
  }
  if(req.body.hospitalsId){
    sql+="and s.hospital_id = '"+req.body.hospitalsId+"' "
  }
  if(req.body.business){
    sql+="and d.product_business = '"+req.body.business+"' "
  }

  var gapSql = "select interval((sg.sale_price-sg.accounting_cost)*100/sg.sale_price";
  req.body.rate_gap = req.body.rate_gap?req.body.rate_gap:10;
  var len = Math.round(100/req.body.rate_gap);
  for(var i = 0 ; i < len ;i++){
    gapSql+=","+req.body.rate_gap*i+""
  }
  gapSql += ") as realRate,sum(sg.sale_money) sale_money,sum(sg.real_gross_profit) real_gross_profit from ("+sql+") sg group by realRate "+
            "having sum(sg.sale_money) > 0";
  var sales = DB.get("Sales");
  sales.executeSql(gapSql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "报表查询销售记录按真实毛利率，出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
//查询销售按销售单位
router.post("/getSalesByHospital",function(req,res){
  if(req.session.user[0].authority_code.indexOf("99") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var sql = "select h.hospital_name,sum(s.sale_money) sale_money from sales s left join hospitals h "+
            "on s.hospital_id = h.hospital_id where s.delete_flag='0' and s.group_id = '"+req.session.user[0].group_id+"' "+
            "and h.delete_flag='0' and h.group_id = '"+req.session.user[0].group_id+"' ";
  if(req.body.data.salesTime && req.body.data.salesTime.length > 1){
    var start = new Date(req.body.data.salesTime[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.salesTime[1]).format("yyyy-MM-dd");
    sql += " and DATE_FORMAT(s.bill_date,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(s.bill_date,'%Y-%m-%d') <= '"+end+"'";
  }
  if(req.body.data.business){
    sql+=" and s.hospital_id = '"+req.body.data.business+"' "
  }
  sql+=" group by h.hospital_id";
  var sales = DB.get("Sales");
  sales.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "报表查询销售记录按销售单位总数，出错" + err);
    }
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql += " order by sum(s.sale_money) desc limit " + req.body.page.start + "," + req.body.page.limit + "";
    sales.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "报表查询销售记录按销售单位，出错" + err);
      }
      req.body.page.data = result;
      res.json({"code":"000000",message:req.body.page});
    });
  });
});

//查询销售按品种
router.post("/getSalesByProduct",function(req,res){
  if(req.session.user[0].authority_code.indexOf("99") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var sql = "select sum(s.sale_num) sale_num,sum(s.sale_money) sale_money,d.product_common_name,d.product_specifications,d.product_makesmakers from sales s left join drugs d "+
            "on s.product_code = d.product_code where s.delete_flag='0' and s.group_id = '"+req.session.user[0].group_id+"' "+
            "and d.delete_flag='0' and d.group_id = '"+req.session.user[0].group_id+"' ";
  if(req.body.data.salesTime && req.body.data.salesTime.length > 1){
    var start = new Date(req.body.data.salesTime[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.salesTime[1]).format("yyyy-MM-dd");
    sql += " and DATE_FORMAT(s.bill_date,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(s.bill_date,'%Y-%m-%d') <= '"+end+"'";
  }
  if(req.body.data.hospitalsId){
    sql+="and s.hospital_id = '"+req.body.data.hospitalsId+"' "
  }
  if(req.body.data.business){
    sql+="and d.product_business = '"+req.body.data.business+"' "
  }
  sql+="group by d.product_common_name,d.product_specifications,d.product_makesmakers";
  var sales = DB.get("Sales");
  sales.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "报表查询销售记录按品种总数，出错" + err);
    }
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql += " order by sum(s.sale_money) desc limit " + req.body.page.start + "," + req.body.page.limit + "";
    sales.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "报表查询销售记录按品种，出错" + err);
      }
      req.body.page.data = result;
      res.json({"code":"000000",message:req.body.page});
    });
  });
});

//查询佣金外欠金额，按联系人
router.post("/getSalesReturnByContacts",function(req,res){
  if(req.session.user[0].authority_code.indexOf("99") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  //返款类型1：按销售返款 2：表示是采购（高打）返款 3：无返款
  var sql = "select * from sales s left join refunds r on s.sale_id = r.sales_id where s.group_id = '"+req.session.user[0].group_id+"' and s.sale_return_flag = '1' "+
            "and s.delete_flag = '0' and r.refunds_real_time is null && (r.refunds_real_money is null || r.refunds_real_money = '')";

  sql = "select sd.*,d.contacts_id from ("+sql+") sd left join drugs d on sd.product_code = d.product_code where d.delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"' ";
  sql = "select c.contacts_name,sum(sdc.refunds_should_money) rsm,c.contacts_phone from ("+sql+") sdc left join contacts c on c.contacts_id = sdc.contacts_id where c.delete_flag = '0' and c.group_id = '"+req.session.user[0].group_id+"' "+
        "group by c.contacts_name,c.contacts_phone having sum(sdc.refunds_should_money) > 0 order by sum(sdc.refunds_should_money) desc ";
  var sales = DB.get("Sales");
  sales.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "报表查询佣金欠款金额按人员，出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
//查询高打外欠金额，按联系人
router.post("/getPurchasesReturnByContacts",function(req,res){
  if(req.session.user[0].authority_code.indexOf("99") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  //返款记录需要手动修改的时候保存，所以，在查询所有返款时，要用采购记录，左连接返款记录
  //返款类型1：按销售返款 2：表示是采购（高打）返款 3：无返款
  var prsql = "select * from purchase pr left join refunds r on pr.purchase_id = r.purchases_id where pr.purchase_return_flag='2' and pr.make_money_time is not null "+
              "and r.refunds_real_time is null && (r.refunds_real_money is null || r.refunds_real_money = '') "+
              "and pr.delete_flag = '0' and pr.group_id = '"+req.session.user[0].group_id+"'";
  //连接查询联系人、药品信息
  var sql = "select p.*,d.contacts_id from ("+prsql+") p left join drugs d on p.drug_id = d.product_id where d.delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"' ";
  sql = "select c.contacts_name,sum(pd.refunds_should_money) rsm,c.contacts_phone from ("+sql+") pd left join contacts c on c.contacts_id = pd.contacts_id where c.delete_flag = '0' and c.group_id = '"+req.session.user[0].group_id+"' "+
        "group by c.contacts_name,c.contacts_phone having sum(pd.refunds_should_money) > 0 order by sum(pd.refunds_should_money) desc ";

  var sales = DB.get("Sales");
  sales.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "报表查询高打欠款金额按人员，出错" + err);
    }
    res.json({"code":"000000",message:result});
  });

});
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
                "and (td.tag_drug_deleta_flag = '0' or td.tag_drug_deleta_flag is null) "+
                "and t.tag_delete_flag = '0' and t.tag_group_id = '"+req.session.user[0].group_id+"'";
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
