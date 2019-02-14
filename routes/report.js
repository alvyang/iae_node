var express = require("express");
var logger = require('../utils/logger');
var util= require('../utils/global_util.js');
var router = express.Router();

//查询利润负债，综合查询
router.post("/getReportComprehensive",function(req,res){
  if(req.session.user[0].authority_code.indexOf("99,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  getComprehensive(req).then(data => {
    //销售表，综合统计回款情况，销售情况，库存负债情况
    var result = getGroupData(data);
    //调货相关数据
    getAllotComprehensive(req,result).then(data=>{
      //备货相关数据
      getPurchaseComprehensive(req,data).then(data=>{
        res.json({"code":"000000",message:data});
      });
    });
  });
});
function getPurchaseComprehensive(req,data){
  var sql = "select * from purchase p left join refunds r on p.purchase_id = r.purchases_id "+
            "where p.delete_flag = '0' and p.group_id = '"+req.session.user[0].group_id+"' "+
            "and p.purchase_return_flag='2' and p.make_money_time is not null and r.refund_delete_flag = '0' ";
  //查询近12个月日期
  var dataSql = "select @rownum :=@rownum + 1 AS num,date_format(DATE_SUB(now(),INTERVAL @rownum MONTH),'%Y-%m') AS all_day "+
                "FROM (SELECT @rownum := -1) AS r_init,(select * from sales s limit 12) as c_init";
  var rSql = "select * from ("+dataSql+") t1 right join ("+sql+") t2 on t1.all_day = DATE_FORMAT(t2.make_money_time,'%Y-%m') order by t1.all_day desc";
  return new Promise((resolve, reject) => {//查询所有药品编码{
    var sales = DB.get("Sales");
    sales.executeSql(rSql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "综合查询，查询备货相关部分出错" + err);
      }
      for(var i = 0 ; i < result.length ;i++){
        var temp = new Date(result[i].refunds_real_time).format("yyyy-MM");
        var purchaseTime = new Date(result[i].make_money_time).format("yyyy-MM");
        for(var j = 0 ; j<data.length;j++){
          if(result[i].refunds_real_money && result[i].refunds_real_time && result[i].receiver && data[j].time == temp){
            data[j].apurchaseReturnMoney1=data[j].apurchaseReturnMoney1?data[j].apurchaseReturnMoney1:0;//调货已回款
            data[j].apurchaseReturnMoney1+=result[i].refunds_real_money?parseFloat(result[i].refunds_real_money):0;
          }
          if(result[i].refunds_real_money && result[i].refunds_real_time && data[j].time == purchaseTime){
            data[j].apurchaseReturnMoney0=data[j].apurchaseReturnMoney0?data[j].apurchaseReturnMoney0:0;//调货未回款
            data[j].apurchaseReturnMoney0+=result[i].refunds_real_money?parseFloat(result[i].refunds_real_money):0;
          }else if(result[i].make_money_time && data[j].time == purchaseTime){
            data[j].npurchaseReturnMoney0=data[j].npurchaseReturnMoney0?data[j].npurchaseReturnMoney0:0;//调货未回款
            data[j].npurchaseReturnMoney0+=result[i].refunds_should_money?parseFloat(result[i].refunds_should_money):0;
          }
        }
      }
      for(var i = 0 ; i < data.length;i++){
        data[i].apurchaseReturnMoney1=Math.round(data[i].apurchaseReturnMoney1*100)/100;
        data[i].apurchaseReturnMoney0=Math.round(data[i].apurchaseReturnMoney0*100)/100;
        data[i].npurchaseReturnMoney0=Math.round(data[i].npurchaseReturnMoney0*100)/100;
      }
      resolve(data);
    });
  });
}
//查询调货记录，返款等记录
function getAllotComprehensive(req,data){
  var sql = "select * from allot a where a.allot_delete_flag = '0' and a.allot_group_id = '"+req.session.user[0].group_id+"' ";
  //查询近12个月日期
  var dataSql = "select @rownum :=@rownum + 1 AS num,date_format(DATE_SUB(now(),INTERVAL @rownum MONTH),'%Y-%m') AS all_day "+
                "FROM (SELECT @rownum := -1) AS r_init,(select * from sales s limit 12) as c_init";
  var rSql = "select * from ("+dataSql+") t1 left join ("+sql+") t2 on t1.all_day = DATE_FORMAT(t2.allot_time,'%Y-%m') order by t1.all_day desc";
  return new Promise((resolve, reject) => {//查询所有药品编码{
    var sales = DB.get("Sales");
    sales.executeSql(rSql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "综合查询，查询调货相关部分出错" + err);
      }
      for(var i = 0 ; i < result.length ;i++){
        var temp = new Date(result[i].allot_return_time).format("yyyy-MM");
        var allotTime = new Date(result[i].allot_time).format("yyyy-MM");
        for(var j = 0 ; j<data.length;j++){
          if(result[i].allot_return_time && result[i].allot_account_id && data[j].time == allotTime){
            data[j].allotReturnMoney0=data[j].allotReturnMoney0?data[j].allotReturnMoney0:0;//调货已回款
            data[j].allotReturnMoney0+=result[i].allot_return_money?parseFloat(result[i].allot_return_money):0;
          }else if(data[j].time == allotTime){
            data[j].allotReturnMoney1=data[j].allotReturnMoney1?data[j].allotReturnMoney1:0;//调货未回款
            data[j].allotReturnMoney1+=result[i].allot_return_money?parseFloat(result[i].allot_return_money):0;
          }
          if(result[i].allot_return_time && result[i].allot_account_id && data[j].time == temp){
            data[j].callotReturnMoney0=data[j].callotReturnMoney0?data[j].callotReturnMoney0:0;//调货未回款
            data[j].callotReturnMoney0+=result[i].allot_return_money?parseFloat(result[i].allot_return_money):0;
          }
        }
      }
      for(var i = 0 ; i < data.length;i++){
        data[i].allotReturnMoney0=Math.round(data[i].allotReturnMoney0*100)/100;
        data[i].callotReturnMoney0=Math.round(data[i].callotReturnMoney0*100)/100;
        data[i].allotReturnMoney1=Math.round(data[i].allotReturnMoney1*100)/100;
      }
      resolve(data);
    });
  });
}
//将查询出的数据，进行拼接
function getGroupData(d){
  var rd={};
  var st = "";
  for(var i = 0 ; i < d.length;i++){
    rd[d[i].all_day]=rd[d[i].all_day]?rd[d[i].all_day]:{};
    if(st.indexOf(d[i].product_code+",") < 0){//同一个药，只加一次
      st += d[i].product_code+","
      rd[d[i].all_day].stockMoneyReturn = rd[d[i].all_day].stockMoneyReturn?rd[d[i].all_day].stockMoneyReturn:0;
      rd[d[i].all_day].stockMoneyReturn += d[i].stockMoney?parseFloat(d[i].stockMoney):0;
    }
    var temp = new Date(d[i].sale_return_time).format("yyyy-MM");
    if(d[i].product_type == "高打"){
      rd[d[i].all_day].saleMoney0 = rd[d[i].all_day].saleMoney0?rd[d[i].all_day].saleMoney0:0;//高打销售额
      rd[d[i].all_day].saleMoney0 += parseFloat(d[i].sale_money);//高打销售额
      if(d[i].sale_return_time && d[i].sale_account_id){//销售已回款金额
        rd[d[i].all_day].aReturnMoney0 = rd[d[i].all_day].aReturnMoney0?rd[d[i].all_day].aReturnMoney0:0//高打品种，已回款
        rd[d[i].all_day].aReturnMoney0 += d[i].sale_return_money?parseFloat(d[i].sale_return_money):0;//高打品种，已回款
        rd[temp].cReturnMoney0 = rd[temp].cReturnMoney0?rd[temp].cReturnMoney0:0;
        rd[temp].cReturnMoney0 += d[i].sale_return_money?parseFloat(d[i].sale_return_money):0;//高打品种，本月已回款
      }else{//销售未回款金额
        rd[d[i].all_day].nReturnMoney0 = rd[d[i].all_day].nReturnMoney0?rd[d[i].all_day].nReturnMoney0:0//高打品种，未回款
        rd[d[i].all_day].nReturnMoney0 += d[i].sale_return_money?parseFloat(d[i].sale_return_money):0;//高打品种，未回款
      }
    } else if (d[i].product_type == "佣金"){
      rd[d[i].all_day].saleMoney1 = rd[d[i].all_day].saleMoney1?rd[d[i].all_day].saleMoney1:0;//佣金销售额
      rd[d[i].all_day].saleMoney1 += parseFloat(d[i].sale_money);//佣金销售额
      if(d[i].sale_return_time && d[i].sale_account_id){//销售已回款金额
        rd[d[i].all_day].aReturnMoney1 = rd[d[i].all_day].aReturnMoney1?rd[d[i].all_day].aReturnMoney1:0//佣金品种，已回款
        rd[d[i].all_day].aReturnMoney1 += d[i].sale_return_money?parseFloat(d[i].sale_return_money):0;//佣金品种，已回款
        rd[temp].cReturnMoney1 = rd[temp].cReturnMoney1?rd[temp].cReturnMoney1:0;
        rd[temp].cReturnMoney1 += d[i].sale_return_money?parseFloat(d[i].sale_return_money):0;//高打品种，本月已回款
      }else{//销售未回款金额
        rd[d[i].all_day].nReturnMoney1 = rd[d[i].all_day].nReturnMoney1?rd[d[i].all_day].nReturnMoney1:0//佣金品种，未回款
        rd[d[i].all_day].nReturnMoney1 += d[i].sale_return_money?parseFloat(d[i].sale_return_money):0;//佣金品种，未回款
      }
      var tempRefund = new Date(d[i].refunds_real_time).format("yyyy-MM");
      if(d[i].refunds_real_money && d[i].refunds_real_time && d[i].receiver){
        rd[d[i].all_day].refundsMoney1 = rd[d[i].all_day].refundsMoney1?rd[d[i].all_day].refundsMoney1:0;//上游返利
        rd[d[i].all_day].refundsMoney1 += d[i].refunds_real_money?parseFloat(d[i].refunds_real_money):0;
        rd[tempRefund].crefundsMoney1 = rd[tempRefund].crefundsMoney1?rd[tempRefund].crefundsMoney1:0;//上游返利
        rd[tempRefund].crefundsMoney1 += d[i].refunds_real_money?parseFloat(d[i].refunds_real_money):0;
      }else{
        rd[d[i].all_day].srefundsMoney1 = rd[d[i].all_day].srefundsMoney1?rd[d[i].all_day].srefundsMoney1:0;//上游返利
        rd[d[i].all_day].srefundsMoney1 += d[i].refunds_should_money?parseFloat(d[i].refunds_should_money):0;
      }
    } else {
      rd[d[i].all_day].saleMoney2 = rd[d[i].all_day].saleMoney2?rd[d[i].all_day].saleMoney2:0;//其它销售额
      rd[d[i].all_day].saleMoney2 += parseFloat(d[i].sale_money);//其它销售额
    }
  }
  var rdTemp = [];
  for(var key in rd){
    rdTemp.push({
      time:key,
      srefundsMoney1:Math.round(rd[key].srefundsMoney1*100)/100,
      refundsMoney1:Math.round(rd[key].refundsMoney1*100)/100,
      crefundsMoney1:Math.round(rd[key].crefundsMoney1*100)/100,
      saleMoney0:Math.round(rd[key].saleMoney0*100)/100,
      aReturnMoney0:Math.round(rd[key].aReturnMoney0*100)/100,
      nReturnMoney0:Math.round(rd[key].nReturnMoney0*100)/100,
      cReturnMoney0:Math.round(rd[key].cReturnMoney0*100)/100,
      stockMoneyReturn:Math.round(rd[key].stockMoneyReturn*100)/100,
      saleMoney1:Math.round(rd[key].saleMoney1*100)/100,
      aReturnMoney1:Math.round(rd[key].aReturnMoney1*100)/100,
      nReturnMoney1:Math.round(rd[key].nReturnMoney1*100)/100,
      cReturnMoney1:Math.round(rd[key].cReturnMoney1*100)/100,
      saleMoney2:Math.round(rd[key].saleMoney2*100)/100
    });
  }
  return rdTemp;
}
//查询佣金类型的各项数据   这个表里的sql，超级复杂
function getComprehensive(req){
  //stockSql  查询的是，高打药品库存里还有多少库存，并计算，库存积分
  var stockSql = "select sum(r.refunds_real_money*bs.batch_stock_number/p.purchase_number) stockMoney,bs.batch_stock_drug_id from batch_stock bs "+
                 "left join purchase p on bs.batch_stock_purchase_id = p.purchase_id "+
                 "left join refunds r on bs.batch_stock_purchase_id = r.purchases_id "+
                 "where bs.tag_type_delete_flag = '0' and bs.tag_type_group_id = '"+req.session.user[0].group_id+"' group by bs.batch_stock_drug_id ";
  //药品sql，及连接查询库存积分
  var drugStockSql = "select ds.*,stockSql.stockMoney from drugs ds left join ("+stockSql+") stockSql on ds.product_id = stockSql.batch_stock_drug_id "+
                     "where ds.delete_flag = '0' and ds.group_id = '"+req.session.user[0].group_id+"'";
  //销售查询
  var sql = "select s.*,rs.*,d.stockMoney,d.product_type from sales s left join ("+drugStockSql+") d on s.product_code = d.product_code "+
            "left join refunds rs on rs.sales_id = s.sale_id "+
            "where s.delete_flag='0' and s.group_id = '"+req.session.user[0].group_id+"' ";
  if(req.body.hospitalsId){
    sql+="and s.hospital_id = '"+req.body.hospitalsId+"' "
  }
  if(req.body.business){
    sql+="and d.product_business = '"+req.body.business+"' "
  }
  //查询近12个月日期
  var dataSql = "select @rownum :=@rownum + 1 AS num,date_format(DATE_SUB(now(),INTERVAL @rownum MONTH),'%Y-%m') AS all_day "+
                "FROM (SELECT @rownum := -1) AS r_init,(select * from sales s limit 12) as c_init";

  var rSql = "select * from ("+dataSql+") t1 left join ("+sql+") t2 on t1.all_day = DATE_FORMAT(t2.bill_date,'%Y-%m') order by t1.all_day desc";
  return new Promise((resolve, reject) => {//查询所有药品编码{
    var sales = DB.get("Sales");
    sales.executeSql(rSql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "综合查询，查询销售额，销售回积分出错" + err);
      }
      resolve(result);
    });
  });
}
//查询销售按真实毛利率
router.post("/getSalesByProfitRate",function(req,res){
  if(req.session.user[0].authority_code.indexOf("99,") < 0){
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
  if(req.session.user[0].authority_code.indexOf("99,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var sql = "select h.hospital_name,sum(s.sale_money) sale_money from sales s "+
            "left join drugs d on s.product_code = d.product_code "+
            "left join business b on d.product_business = b.business_id "+
            "left join hospitals h on s.hospital_id = h.hospital_id "+
            "where s.delete_flag='0' and s.group_id = '"+req.session.user[0].group_id+"' "+
            "and d.delete_flag='0' and d.group_id = '"+req.session.user[0].group_id+"' "+
            "and h.delete_flag='0' and h.group_id = '"+req.session.user[0].group_id+"' "+
            "and b.business_delete_flag='0' and b.business_group_id = '"+req.session.user[0].group_id+"' ";
  if(req.body.data.salesTime && req.body.data.salesTime.length > 1){
    var start = new Date(req.body.data.salesTime[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.salesTime[1]).format("yyyy-MM-dd");
    sql += " and DATE_FORMAT(s.bill_date,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(s.bill_date,'%Y-%m-%d') <= '"+end+"'";
  }
  if(req.body.data.business){
    sql+=" and d.product_business = '"+req.body.data.business+"' "
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
  if(req.session.user[0].authority_code.indexOf("99,") < 0){
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
  if(req.session.user[0].authority_code.indexOf("99,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  //返款类型1：按销售返款 2：表示是采购（高打）返款 3：无返款
  var sql = "select * from sales s left join refunds r on s.sale_id = r.sales_id where s.group_id = '"+req.session.user[0].group_id+"' and s.sale_return_flag = '1' "+
            "and s.delete_flag = '0' and r.refund_delete_flag='0' and r.refunds_real_time is null && (r.refunds_real_money is null || r.refunds_real_money = '')";

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
  if(req.session.user[0].authority_code.indexOf("99,") < 0){
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
  if(req.session.user[0].authority_code.indexOf("99,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var sales = DB.get("Sales");
  //连接查询标签和药品表，查出所有药品包含的所有标签
  var sql = "select td.drug_id,t.tag_name,t.tag_id from tag t left join tag_drug td on td.tag_id = t.tag_id "+
                "where (td.tag_drug_group_id = '"+req.session.user[0].group_id+"' or td.tag_drug_group_id is null) "+
                "and (td.tag_drug_deleta_flag = '0' or td.tag_drug_deleta_flag is null) "+
                "and t.tag_delete_flag = '0' and t.tag_group_id = '"+req.session.user[0].group_id+"'";
  if(req.body.tag_type){
    sql += " and t.tag_type = '"+req.body.tag_type+"'";
  }
  sql = "select tdt.tag_name,tdt.tag_id,d.product_code,d.product_business from ("+sql+") tdt left join drugs d on d.product_id = tdt.drug_id "+
        "where d.delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"' ";

  sql = "select ifnull(sum(s.sale_money),0) sm,ifnull(sum(s.real_gross_profit),0) rgp ,sd.tag_name  from ("+sql+") sd left join sales s "+
        "on sd.product_code = s.product_code where s.delete_flag = '0' and s.group_id = '"+req.session.user[0].group_id+"' ";
  if(req.body.salesTime && req.body.salesTime.length > 1){
    var start = new Date(req.body.salesTime[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.salesTime[1]).format("yyyy-MM-dd");
    sql += " and DATE_FORMAT(s.bill_date,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(s.bill_date,'%Y-%m-%d') <= '"+end+"'";
  }
  if(req.body.hospitalsId){
    sql+=" and s.hospital_id = '"+req.body.hospitalsId+"' "
  }
  if(req.body.business){
    sql+=" and sd.product_business = '"+req.body.business+"' "
  }
  sql += " group by sd.tag_id";
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
  if(req.session.user[0].authority_code.indexOf("99,") < 0){
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
            "where s.delete_flag ='0' and s.group_id = '"+req.session.user[0].group_id+"' "+
            " and d.delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"' ";
  if(req.body.hospitalsId){
    sql+="and s.hospital_id = '"+req.body.hospitalsId+"' "
  }
  if(req.body.business){
    sql+="and d.product_business = '"+req.body.business+"' "
  }
  sql += "group by DATE_FORMAT(s.bill_date,'%Y-%m') ";

  var s = "select t.all_day,ifnull(st.sm,0) smt,ifnull(st.rgp,0) rgpt from ("+dataSql+") t left join ("+sql+") st on st.bd = t.all_day order by t.all_day desc";
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
