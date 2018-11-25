var express = require("express");
var logger = require('../utils/logger');
var util = require('../utils/global_util');
var router = express.Router();

//新增联系人
router.post("/saveBunsinessCommission",function(req,res){
  if(req.session.user[0].authority_code.indexOf("80") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var businesscommission = DB.get("BusinessCommission");
  req.body.commission_group_id = req.session.user[0].group_id;
  req.body.commission_time = new Date(req.body.commission_time).format('yyyy-MM-dd');
  if(req.body.commission_id){
    businesscommission.update(req.body,'commission_id',function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "修改商业成本率出错" + err);
      }
      res.json({"code":"000000",message:null});
    });
  }else{
    delete req.body.commission_id;
    businesscommission.insert(req.body,'commission_id',function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "新增商业成本率出错" + err);
      }
      res.json({"code":"000000",message:result});
    });
  }
});
//获取商务提成列表
router.post("/getBuninessCommission",function(req,res){
  if(req.session.user[0].authority_code.indexOf("79") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var sales = DB.get("Sales");
  //拼接sql
  var sql = getBusinessCommissionSql(req);
  sales.countBySql(sql.sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询商业提成，查询总数出错" + err);
    }
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql.sql += " order by s.bd desc";
    sales.executeSql(sql.sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "查询商业提成出错" + err);
      }
      getDayCommissionData(req,sql.daySql).then(dayCommission=>{
        var temp = formatCommissionData(result,dayCommission);
        req.body.page.data = temp.data;
        req.body.page.account = temp.account;
        res.json({"code":"000000",message:req.body.page});
      });
    });
  });
});
function getBusinessCommissionSql(req){
  //连接查询销售表和商品表 用于取药品
  var sql = "select sd.*,d.product_business from sales sd left join drugs d on sd.product_code = d.product_code "+
            "where sd.delete_flag = '0' and sd.group_id = '"+req.session.user[0].group_id+"' and d.delete_flag='0' ";
  if(req.body.data.startTime){
    req.body.data.startTime = new Date(req.body.data.startTime).format('yyyy-MM');
    sql += " and DATE_FORMAT(sd.bill_date,'%Y-%m') >= '"+req.body.data.startTime+"'";
  }
  if(req.body.data.endTime){
    req.body.data.endTime = new Date(req.body.data.endTime).format('yyyy-MM');
    sql += " and DATE_FORMAT(sd.bill_date,'%Y-%m') <= '"+req.body.data.endTime+"'";
  }
  if(req.body.data.business){
    sql += " and d.product_business = '"+req.body.data.business+"' ";
  }
  if(req.body.data.hospitalsId){
    sql += " and sd.hospital_id = '"+req.body.data.hospitalsId+"' ";
  }
  //按销售日分组查询，用于统计日均应收账款
  var daySql = "select sum(daysql.sale_money) sm,DATE_FORMAT(daysql.bill_date,'%Y-%m-%d') billDate,daysql.hospital_id,daysql.product_business from ("+sql+") daysql "+
               "left join hospital_business_config hbc on daysql.product_business = hbc.hb_business_id and daysql.hospital_id = hbc.hb_hospital_id "+
               "where DATE_FORMAT(daysql.bill_date,'%Y-%m-%d') >= DATE_FORMAT(hbc.hb_start_time,'%Y-%m-%d') "+
               "and hbc.hb_fixed_rate is not null and hbc.hb_start_money is not null and hbc.hb_floating_rate is not null "+
               "group by DATE_FORMAT(daysql.bill_date,'%Y-%m-%d'),daysql.hospital_id,daysql.product_business";
  //连接查询商业表 取商业名称
  sql = "select sdb.*,bus.business_name from ("+sql+") sdb left join business bus on sdb.product_business = bus.business_id ";
  //连接查询医院表  取医院名称
  sql = "select sdbh.*,h.hospital_name from ("+sql+") sdbh left join hospitals h on sdbh.hospital_id = h.hospital_id ";
  //连接查询提成配置信息
  sql = "select avg(hbc.hb_start_money) hb_start_money,avg(hbc.hb_fixed_rate) hb_fixed_rate,avg(hbc.hb_floating_rate) hb_floating_rate,"+
        "sdhbc.hospital_id,sdhbc.hospital_name,DATE_FORMAT(sdhbc.bill_date,'%Y-%m') bd,sum(sdhbc.sale_money) sm, "+
        "sum(sdhbc.real_gross_profit) rgp,sum(sdhbc.real_gross_profit*(1-sdhbc.sale_tax_rate)) rgpt,sdhbc.product_business,sdhbc.business_name "+
        "from ("+sql+") sdhbc left join hospital_business_config hbc on "+
        "sdhbc.product_business = hbc.hb_business_id and sdhbc.hospital_id = hbc.hb_hospital_id "+
        "where DATE_FORMAT(sdhbc.bill_date,'%Y-%m-%d') >= DATE_FORMAT(hbc.hb_start_time,'%Y-%m-%d') "+
        "and hbc.hb_fixed_rate is not null and hbc.hb_start_money is not null and hbc.hb_floating_rate is not null "+
        "group by DATE_FORMAT(sdhbc.bill_date,'%Y-%m'),sdhbc.hospital_id,sdhbc.product_business";
  //连接查询商业提成表
  sql = "select * from ("+sql+") s left join business_commission bc on s.hospital_id = bc.commission_hospital_id and "+
        "s.product_business = bc.commission_business and s.bd = DATE_FORMAT(bc.commission_time,'%Y-%m') ";
  return {
    sql:sql,
    daySql:daySql
  };
};
//计算日均应返金额等数据
function getDayCommissionData(req,sql){
  var sales = DB.get("Sales");
  return new Promise((resolve, reject) => {//按日分组查询，
    sales.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "计算日均商业提成，按日分组查询销售记录出错" + err);
         reject(err);
      }else{
        resolve(result);
      }
    });
  }).then(daySale=>{//查询调货政策
    return new Promise((resolve, reject) => {//查询所有医院回款记录
      var hospitalsReturnSql = "select hrmb.* from hospital_return_money hrmb where hrmb.return_money_group_id = '"+req.session.user[0].group_id+"' and hrmb.return_money_delete_flag = '0'";
      sales.executeSql(hospitalsReturnSql,function(err,result){
        if(err){
          logger.error(req.session.user[0].realname + "计算日均商业提成，按日分组查询销售记录出错" + err);
           reject(err);
        }else{
          //计算日均返款额
          var dayCommission = formatDayCommissionData(daySale,result);
          resolve(dayCommission);
        }
      });
    });
  });
}
/*
 * 计算日均商务提成，计算规则为  销售日销售额总额  除  当前月天数   乘剩余天数
 * 例   2018年1月10日  销售  1000   日均为：1000/31*22
 * 再加上，医院回款额当月剩余天数
 * 例  2018年1月22日 医院回款1000   日均为 1000/31*10
 */
function formatDayCommissionData(daySale,hospitalsReturn){
  var dayCommission={};//计算统计后的数据，对象
  for(var i = 0 ; i < daySale.length ;i++){
    var billDate = new Date(daySale[i].billDate);//销售日期
    var lastDay = util.getLastDateOfMonth(billDate.getFullYear(),billDate.getMonth());//销售日，最后日期
    var billDateDay = parseInt(lastDay.format("yyyy-MM-dd").split("-")[2]);//销售日当月天数
    var intDay = parseInt((lastDay - billDate) / (1000 * 60 * 60 * 24))+2;//销售日距当月最后一天，天数
    if(lastDay.format("yyyy-MM-dd")==billDate.format("yyyy-MM-dd")){//上一条代码，做的不好
      intDay--;
    }
    var key = billDate.format("yyyy-MM")+"_"+daySale[i].hospital_id+"_"+daySale[i].product_business;
    dayCommission[key]=dayCommission[key]?dayCommission[key]:0;
    dayCommission[key]+=util.mul(util.div(daySale[i].sm,billDateDay,6),intDay,4);
  }
  for(var i in dayCommission){
    var key = i.split("_");
    var returnMoney = 0;
    for(var j = 0 ; j < hospitalsReturn.length ;j++){
      if(key[1] == hospitalsReturn[j].return_money_hospital &&
         key[2] == hospitalsReturn[j].return_money_business &&
         key[0] == new Date(hospitalsReturn[j].return_money_time).format("yyyy-MM")){
         var returnMoneyDate = new Date(hospitalsReturn[j].return_money_time);//医院回款时间
         var lastDay = util.getLastDateOfMonth(returnMoneyDate.getFullYear(),returnMoneyDate.getMonth());//医院回款日，最后日期
         var billDateDay = parseInt(lastDay.format("yyyy-MM-dd").split("-")[2]);//销售日当月天数
         var intDay = parseInt((lastDay - returnMoneyDate) / (1000 * 60 * 60 * 24))+1;//销售日距当月最后一天，天数
         if(lastDay.format("yyyy-MM-dd")==returnMoneyDate.format("yyyy-MM-dd")){//上一条代码，做的不好
           intDay--;
         }
         returnMoney +=parseFloat(hospitalsReturn[j].return_money);
         var temp = util.mul(util.div(hospitalsReturn[j].return_money,billDateDay,6),intDay,4);//回款月均
         dayCommission[i] = util.sub(dayCommission[i],temp,2);
      }
    }
    dayCommission[i+"_return_money"]=returnMoney;
  }
  return dayCommission;
}
//计算月累计欠款金额
function formatCommissionData(data,dayCommission){
  var sumMoney = {};
  var mouthGap = {};
  var l = data.length-1;
  var account = {
    smAccount:0,
    rgpAccount:0,
    rgptAccount:0,
    profitAccount:0,
    dayAvgprofitAccount:0
  };
  for(var i = l ; i >= 0 ;i--){
    var temp = {};
    //四舍五入金额 销售额、真实毛利、真实毛利（不含税） 计算
    temp.sm = Math.round(data[i].sm*100)/100;
    //真实毛利
    temp.rgp = Math.round(data[i].rgp*100)/100;
    //真实毛利率
    temp.rgpPercent = Math.round(util.div(data[i].rgp,data[i].sm,4)*10000)/100;
    //真实毛利不含税
    temp.rgpt = Math.round(data[i].rgpt*100)/100;
    //真实毛利不含税率
    temp.rgptPercent = Math.round(util.div(data[i].rgpt,data[i].sm,4)*10000)/100;
    temp.hb_fixed_rate = data[i].commission_fixed_rate?data[i].commission_fixed_rate:data[i].hb_fixed_rate;
    temp.hb_floating_rate = data[i].commission_floating_rate?data[i].commission_floating_rate:data[i].hb_floating_rate;
    //计算当月欠款金额
    var moneyKey = data[i].hospital_id+"-"+data[i].product_business;
    sumMoney[moneyKey] = sumMoney[moneyKey]?sumMoney[moneyKey]:data[i].hb_start_money;
    var dayKey = data[i].bd+"_"+data[i].hospital_id+"_"+data[i].product_business;//取月均值
    temp.day_avg = util.add(sumMoney[moneyKey],dayCommission[dayKey],2);
    //累计
    temp.return_money = dayCommission[dayKey+"_return_money"]?dayCommission[dayKey+"_return_money"]:0;
    temp.ownMoney = util.sub(util.add(data[i].sm,sumMoney[moneyKey]),dayCommission[dayKey+"_return_money"],2);
    sumMoney[moneyKey] = temp.ownMoney;
    //月末就收系数
    temp.mouthCoefficient = util.div(temp.ownMoney,data[i].sm,2);
    //日均应收系数
    temp.dayAvgCoefficient = util.div(temp.day_avg,data[i].sm,2);
    //商务提成
    var frontMonthOwnMonwy=0;
    if(mouthGap[moneyKey]){//如果某月没有销售，获取连续几个月没有销
      var gap = util.getIntervalMonth(new Date(mouthGap[moneyKey]),new Date(data[i].bd))-1;
      frontMonthOwnMonwy = mouthGap[moneyKey+"ownMoney"]*gap*data[i].hb_floating_rate/100;
    }
    mouthGap[moneyKey]=data[i].bd;
    mouthGap[moneyKey+"ownMoney"]=temp.ownMoney;
    temp.profit = data[i].rgpt - data[i].sm*data[i].hb_fixed_rate/100 - temp.ownMoney*data[i].hb_floating_rate/100 - frontMonthOwnMonwy;
    temp.profit = Math.round(temp.profit*100)/100;
    //商务提成，按日均算
    temp.dayAvgprofit = data[i].rgpt - data[i].sm*data[i].hb_fixed_rate/100 - temp.day_avg*data[i].hb_floating_rate/100 - frontMonthOwnMonwy;
    temp.dayAvgprofit = Math.round(temp.dayAvgprofit*100)/100;
    //商务提成
    temp.profitCoefficient = Math.round(temp.profit/data[i].sm*10000)/100;
    //商务提成，按日均算
    temp.dayAvgprofitCoefficient = Math.round(temp.dayAvgprofit/data[i].sm*10000)/100;
    Object.assign(data[i],temp);
    account.smAccount+=data[i].sm;
    account.rgpAccount+=data[i].rgp;
    account.rgptAccount+=data[i].rgpt;
    account.profitAccount+=data[i].profit;
    account.dayAvgprofitAccount+=data[i].dayAvgprofit;
  }
  account.smAccount=Math.round(account.smAccount*100)/100;
  account.rgpAccount=Math.round(account.rgpAccount*100)/100;
  account.rgptAccount=Math.round(account.rgptAccount*100)/100;
  account.profitAccount=Math.round(account.profitAccount*100)/100;
  account.dayAvgprofitAccount=Math.round(account.dayAvgprofitAccount*100)/100;
  return {
    data:data,
    account:account
  };
}
module.exports = router;
