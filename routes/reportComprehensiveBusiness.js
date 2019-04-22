var express = require("express");
var logger = require('../utils/logger');
var util= require('../utils/global_util.js');
var router = express.Router();

//按调货单位查询利润负债表
router.post("/getReportComprehensiveAllot",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",99,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  getAllotComprehensive(req).then(data => {
    //销售表，综合统计回款情况，销售情况，库存负债情况
    res.json({"code":"000000",message:data});
  });
});
//查询调货记录，返款等记录
function getAllotComprehensive(req,data){
  var sDate = new Date(req.body.time).format("yyyy-MM");
  var sql = "select a.*,h.hospital_id,h.hospital_name,p.purchase_number,r.refunds_should_money,r.refunds_real_money "+
            "d.product_common_name,d.product_specifications,d.product_makesmakers,d.product_packing,d.product_unit,"+
            "d.product_return_money,b.business_name,b.business_id "+
            "from allot a left join purchase p on a.allot_purchase_id = p.purchase_id "+
            "left join drugs d on a.allot_drug_id = d.product_id "+
            "left join refunds r on r.purchases_id = p.purchase_id and r.refund_delete_flag = '0' "+
            "left join business b on b.business_id = d.product_business "+
            "left join hospitals h on a.allot_hospital = h.hospital_id "+
            "where a.allot_delete_flag = '0' and a.allot_group_id = '"+req.session.user[0].group_id+"' "+
            "and p.delete_flag = '0' and p.group_id = '"+req.session.user[0].group_id+"' "+
            "and DATE_FORMAT(a.allot_time,'%Y-%m') = '"+sDate+"' ";
  if(req.body.hospitalsId){
    sql+="and a.allot_hospital = '"+req.body.hospitalsId+"' ";
  }
  if(req.body.business){
    sql+="and d.product_business = '"+req.body.business+"' ";
  }
  return new Promise((resolve, reject) => {//查询所有药品编码{
    var sales = DB.get("Sales");
    sales.executeSql(sql,function(err,d){
      if(err){
        logger.error(req.session.user[0].realname + "综合查询，查询调货相关部分出错" + err);
      }
      var rd = {};
      d = d?d:[];
      for(var i = 0 ; i < d.length ;i++){
        rd[d[i].product_business]=rd[d[i].product_business]?rd[d[i].product_business]:{};
        rd[d[i].product_business].businessName = rd[d[i].product_business].businessName?rd[d[i].product_business].businessName:d[i].business_name;
        rd[d[i].product_business].businessId = rd[d[i].product_business].businessId?rd[d[i].product_business].businessId:d[i].business_id;


        rd[d[i].product_business].allotMoney=rd[d[i].product_business].allotMoney?rd[d[i].product_business].allotMoney:0;
        rd[d[i].product_business].allotMoney += d[i].allot_money?parseFloat(d[i].allot_money):0;

        rd[d[i].product_business].allotReturnMoney=rd[d[i].product_business].allotReturnMoney?rd[d[i].product_business].allotReturnMoney:0;//调货应付款
        rd[d[i].product_business].allotReturnMoney+=d[i].allot_return_money?parseFloat(d[i].allot_return_money):0;

        if(d[i].refunds_should_money && d[i].purchase_number){
          rd[d[i].product_business].allotShouldReturn = rd[d[i].product_business].allotShouldReturn?rd[d[i].product_business].allotShouldReturn:0;//调货应返
          rd[d[i].product_business].allotShouldReturn += d[i].refunds_should_money*d[i].allot_number/d[i].purchase_number;
          if(d[i].refunds_real_money && d[i].refunds_real_money > 0){
            rd[d[i].product_business].allotRealReturn = rd[d[i].product_business].allotRealReturn?rd[d[i].product_business].allotRealReturn:0;//调货实返
            rd[d[i].product_business].allotRealReturn += d[i].refunds_real_money*d[i].allot_number/d[i].purchase_number;
          }else{
            rd[d[i].product_business].allotNoReturn = rd[d[i].product_business].allotNoReturn?rd[d[i].product_business].allotNoReturn:0;//调货未返
            rd[d[i].product_business].allotNoReturn += d[i].refunds_should_money*d[i].allot_number/d[i].purchase_number;
          }
        }
        if(d[i].allot_real_return_money > 0 && d[i].allot_return_time){
          rd[d[i].product_business].allotReturnMoney0=rd[d[i].product_business].allotReturnMoney0?rd[d[i].product_business].allotReturnMoney0:0;//调货已付款
          rd[d[i].product_business].allotReturnMoney0+=d[i].allot_real_return_money?parseFloat(d[i].allot_real_return_money):0;
        }else{
          rd[d[i].product_business].allotReturnMoney1=rd[d[i].product_business].allotReturnMoney1?rd[d[i].product_business].allotReturnMoney1:0;//调货未付款
          rd[d[i].product_business].allotReturnMoney1+=d[i].allot_return_money?parseFloat(d[i].allot_return_money):0;
        }
      }
      var rdTemp = [];
      for(var key in rd){
        rdTemp.push({
          allotMoney:rd[key].allotMoney,
          businessName:rd[key].businessName,
          businessId:rd[key].businessId,
          allotReturnMoney:Math.round(rd[key].allotReturnMoney*100)/100,
          allotReturnMoney0:Math.round(rd[key].allotReturnMoney0*100)/100,
          allotReturnMoney1:Math.round(rd[key].allotReturnMoney1*100)/100,
          allotShouldReturn:Math.round(rd[key].allotShouldReturn*100)/100,
          allotRealReturn:Math.round(rd[key].allotRealReturn*100)/100,
          allotNoReturn:Math.round(rd[key].allotNoReturn*100)/100,
        });
      }
      resolve(rdTemp);
    });
  });
}
//按销售单位查询，利润负债表
router.post("/getReportComprehensive",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",99,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  getComprehensive(req).then(data => {
    //销售表，综合统计回款情况，销售情况，库存负债情况
    var result = getGroupData(data);
    res.json({"code":"000000",message:result});
  });
});
//将查询出的数据，进行拼接
function getGroupData(data){
  var rd={};
  var st = "";
  var d = data.d;
  for(var i = 0 ; i < d.length;i++){
    rd[d[i].product_business]=rd[d[i].product_business]?rd[d[i].product_business]:{};
    rd[d[i].product_business].businessName=rd[d[i].product_business].businessName?rd[d[i].product_business].businessName:"";
    rd[d[i].product_business].businessName = d[i].business_name;
    rd[d[i].product_business].businessId=rd[d[i].product_business].businessId?rd[d[i].product_business].businessId:"";
    rd[d[i].product_business].businessId = d[i].business_id;
    rd[d[i].product_business].saleMoney = rd[d[i].product_business].saleMoney?rd[d[i].product_business].saleMoney:0;
    rd[d[i].product_business].saleMoney += parseFloat(d[i].sale_money);//销售总额

    if(d[i].sale_policy_money){
      rd[d[i].product_business].sReturnMoney0 = rd[d[i].product_business].sReturnMoney0?rd[d[i].product_business].sReturnMoney0:0//应付
      rd[d[i].product_business].sReturnMoney0 += d[i].sale_return_money?parseFloat(d[i].sale_return_money):0;//应付
    }
    if(d[i].sale_return_time && d[i].sale_policy_money){//销售已付款金额
      rd[d[i].product_business].aReturnMoney0 = rd[d[i].product_business].aReturnMoney0?rd[d[i].product_business].aReturnMoney0:0//已付
      rd[d[i].product_business].aReturnMoney0 += d[i].sale_return_real_return_money?parseFloat(d[i].sale_return_real_return_money):0;//已付
    }else if(d[i].sale_policy_money){//销售未付金额
      rd[d[i].product_business].nReturnMoney0 = rd[d[i].product_business].nReturnMoney0?rd[d[i].product_business].nReturnMoney0:0//未付
      rd[d[i].product_business].nReturnMoney0 += d[i].sale_return_money?parseFloat(d[i].sale_return_money):0;//未付
    }
    if(d[i].product_type == "高打"){
      rd[d[i].product_business].saleMoney0 = rd[d[i].product_business].saleMoney0?rd[d[i].product_business].saleMoney0:0;//高打销售额
      rd[d[i].product_business].saleMoney0 += parseFloat(d[i].sale_money);//高打销售额
    } else if (d[i].product_type == "佣金"){
      rd[d[i].product_business].saleMoney1 = rd[d[i].product_business].saleMoney1?rd[d[i].product_business].saleMoney1:0;//佣金销售额
      rd[d[i].product_business].saleMoney1 += parseFloat(d[i].sale_money);//佣金销售额
    } else {
      rd[d[i].product_business].saleMoney2 = rd[d[i].product_business].saleMoney2?rd[d[i].product_business].saleMoney2:0;//其它销售额
      rd[d[i].product_business].saleMoney2 += parseFloat(d[i].sale_money);//其它销售额
    }
    if(d[i].sale_return_flag == '1'){//按销售返款
      rd[d[i].product_business].arefundsMoney1 = rd[d[i].product_business].arefundsMoney1?rd[d[i].product_business].arefundsMoney1:0;//上游返利  应收金额
      rd[d[i].product_business].arefundsMoney1 += d[i].refunds_should_money?parseFloat(d[i].refunds_should_money):0;
      if(d[i].refunds_real_money && d[i].refunds_real_time){
        rd[d[i].product_business].refundsMoney1 = rd[d[i].product_business].refundsMoney1?rd[d[i].product_business].refundsMoney1:0;//上游返利  实收金额
        rd[d[i].product_business].refundsMoney1 += d[i].refunds_real_money?parseFloat(d[i].refunds_real_money):0;
      }else{
        rd[d[i].product_business].srefundsMoney1 = rd[d[i].product_business].srefundsMoney1?rd[d[i].product_business].srefundsMoney1:0;//上游返利  未收金额
        rd[d[i].product_business].srefundsMoney1 += d[i].refunds_should_money?parseFloat(d[i].refunds_should_money):0;
      }
    }else if(d[i].sale_return_flag == '2'){//按采进记录返
      //将采购返款，应收积分折算到销售中
      d[i].refunds_should_money2=d[i].refunds_should_money2?parseFloat(d[i].refunds_should_money2):0;
      var salePurchaseMoney = d[i].refunds_should_money2*d[i].sale_num/d[i].purchase_number;
      //将采购返款，实收积分折算到销售中
      d[i].refunds_real_money2=d[i].refunds_real_money2?parseFloat(d[i].refunds_real_money2):0;
      var saleRealPurchaseMoney = d[i].refunds_real_money2*d[i].sale_num/d[i].purchase_number;

      rd[d[i].product_business].arefundsMoney2 = rd[d[i].product_business].arefundsMoney2?rd[d[i].product_business].arefundsMoney2:0;//上游返利  应收金额
      if(d[i].purchase_number){
        rd[d[i].product_business].arefundsMoney2 += salePurchaseMoney;
      }
      rd[d[i].product_business].refundsMoney2 = rd[d[i].product_business].refundsMoney2?rd[d[i].product_business].refundsMoney2:0;//上游返利  实收金额
      rd[d[i].product_business].srefundsMoney2 = rd[d[i].product_business].srefundsMoney2?rd[d[i].product_business].srefundsMoney2:0;//上游返利  未收金额

      if(d[i].refunds_real_money2 && d[i].refunds_real_time2){//已返
        rd[d[i].product_business].refundsMoney2 += saleRealPurchaseMoney;
      }else if(d[i].purchase_number){
        rd[d[i].product_business].srefundsMoney2 += salePurchaseMoney;
      }
    }
  }

  var rdTemp = [];
  for(var key in rd){
    rdTemp.push({
      time:key,
      businessName:rd[key].businessName,
      businessId:rd[key].businessId,
      saleMoney:Math.round(rd[key].saleMoney*100)/100,
      arefundsMoney2:Math.round(rd[key].arefundsMoney2*100)/100,
      refundsMoney2:Math.round(rd[key].refundsMoney2*100)/100,
      srefundsMoney2:Math.round(rd[key].srefundsMoney2*100)/100,
      sReturnMoney0:Math.round(rd[key].sReturnMoney0*100)/100,
      arefundsMoney1:Math.round(rd[key].arefundsMoney1*100)/100,
      srefundsMoney1:Math.round(rd[key].srefundsMoney1*100)/100,
      refundsMoney1:Math.round(rd[key].refundsMoney1*100)/100,
      saleMoney0:Math.round(rd[key].saleMoney0*100)/100,
      aReturnMoney0:Math.round(rd[key].aReturnMoney0*100)/100,
      nReturnMoney0:Math.round(rd[key].nReturnMoney0*100)/100,
      stockMoneyReturn:Math.round(data.stockMoney*100)/100,
      saleMoney1:Math.round(rd[key].saleMoney1*100)/100,
      saleMoney2:Math.round(rd[key].saleMoney2*100)/100
    });
  }
  return rdTemp;
}
//查询佣金类型的各项数据   这个表里的sql，超级复杂
function getComprehensive(req){
  var noDate = new Date();
  var sDate = new Date(req.body.time).format("yyyy-MM");
  //销售查询
  var sql = "select s.*,rs.*,h.hospital_name,rs1.refunds_should_money as refunds_should_money2,rs1.refunds_real_money as refunds_real_money2,"+
            "rs1.refunds_real_time as refunds_real_time2,rs1.receiver as receiver2,"+
            "sp.*,ps.purchase_number,d.product_type,d.product_common_name,d.product_specifications,d.product_makesmakers,d.product_packing,d.product_unit,"+
            "d.product_return_money,b.business_name,b.business_id,d.product_business "+
            "from sales s left join drugs d on s.product_code = d.product_code "+
            "left join hospitals h on s.hospital_id = h.hospital_id "+
            "left join business b on b.business_id = d.product_business "+
            "left join purchase ps on ps.purchase_id = s.sales_purchase_id "+
            "left join refunds rs on rs.sales_id = s.sale_id and rs.refund_delete_flag = '0' "+
            "left join refunds rs1 on ps.purchase_id = rs1.purchases_id and rs1.refund_delete_flag = '0' "+
            "left join sale_policy sp on s.hospital_id = sp.sale_hospital_id and d.product_id = sp.sale_drug_id "+
            "where s.delete_flag='0' and s.group_id = '"+req.session.user[0].group_id+"' "+
            "and d.delete_flag='0' and d.group_id = '"+req.session.user[0].group_id+"' "+
            "and DATE_FORMAT(s.bill_date,'%Y-%m') = '"+sDate+"' ";
  if(req.body.hospitalsId){
    sql+="and s.hospital_id = '"+req.body.hospitalsId+"' ";
  }
  if(req.body.business){
    sql+="and d.product_business = '"+req.body.business+"' ";
  }
  return new Promise((resolve, reject) => {//查询所有药品编码{
    var sales = DB.get("Sales");
    sales.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "综合查询，按销往单位查询" + err);
      }
      resolve({
        d:result
      });
    });
  });
}
module.exports = router;
