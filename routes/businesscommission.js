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
    businesscommission.insertIncrement(req.body,function(err,result){
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
  sales.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询商业提成，查询总数出错" + err);
    }
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql += " order by s.bd desc";
    sales.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "查询商业提成出错" + err);
      }
      var temp = formatCommissionData(result);
      req.body.page.data = temp.data;
      req.body.page.account = temp.account;
      res.json({"code":"000000",message:req.body.page});
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
    sql += " and sd.business_id = '"+req.body.data.business+"' ";
  }
  if(req.body.data.hospitalsId){
    sql += " and sd.hospital_id = '"+req.body.data.hospitalsId+"' ";
  }
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
        "and hbc.hb_fixed_rate is not null and hbc.hb_start_money is not null and hbc.hb_floating_rate is not null ";
  sql += "group by DATE_FORMAT(sdhbc.bill_date,'%Y-%m'),sdhbc.hospital_id,sdhbc.product_business";

  //分组查询返款表
  var hrmSql = "select hrm.return_money_hospital,hrm.return_money_business,DATE_FORMAT(hrm.return_money_time,'%Y-%m') return_money_time,"+
               "sum(hrm.return_money) return_money from hospital_return_money hrm "+
               "group by DATE_FORMAT(hrm.return_money_time,'%Y-%m'),hrm.return_money_hospital,hrm.return_money_business";
  //连接查询当月返款总额
  sql = "select * from ("+sql+") sdhbch left join ("+hrmSql+") hrms on sdhbch.bd = hrms.return_money_time "+
        "and sdhbch.hospital_id = hrms.return_money_hospital and sdhbch.product_business = hrms.return_money_business "

  //连接查询商业提成表
  sql = "select * from ("+sql+") s left join business_commission bc on s.hospital_id = bc.commission_hospital_id and "+
        "s.product_business = bc.commission_business and s.bd = DATE_FORMAT(bc.commission_time,'%Y-%m') ";
  return sql;
};
//计算月累计欠款金额
function formatCommissionData(data){
  var sumMoney = {};
  var mouthGap = {};
  var l = data.length-1;
  var account = {
    smAccount:0,
    rgpAccount:0,
    rgptAccount:0,
    profitAccount:0
  };
  for(var i = l ; i >= 0 ;i--){
    //四舍五入金额 销售额、真实毛利、真实毛利（不含税） 计算
    data[i].sm = Math.round(data[i].sm*100)/100;
    //真实毛利
    data[i].rgp = Math.round(data[i].rgp*100)/100;
    //真实毛利率
    data[i].rgpPercent = Math.round(util.div(data[i].rgp,data[i].sm,4)*10000)/100;
    //真实毛利不含税
    var rgptTemp = data[i].rgpt;
    data[i].rgpt = Math.round(data[i].rgpt*100)/100;
    //真实毛利不含税率
    data[i].rgptPercent = Math.round(util.div(data[i].rgpt,data[i].sm,4)*10000)/100;
    data[i].hb_fixed_rate = data[i].commission_fixed_rate?data[i].commission_fixed_rate:data[i].hb_fixed_rate;
    data[i].hb_floating_rate = data[i].commission_floating_rate?data[i].commission_floating_rate:data[i].hb_floating_rate;
    //计算当月欠款金额
    var moneyKey = data[i].hospital_id+"-"+data[i].business_id;
    sumMoney[moneyKey] = sumMoney[moneyKey]?sumMoney[moneyKey]:data[i].hb_start_money;
    //累计
    data[i].return_money = data[i].return_money?data[i].return_money:0;
    data[i].ownMoney = util.sub(util.add(data[i].sm,sumMoney[moneyKey]),data[i].return_money,2);
    sumMoney[moneyKey] = data[i].ownMoney;
    //月末就收系统
    data[i].mouthCoefficient = util.div(data[i].ownMoney,data[i].sm,2);
    //商务提成
    var frontMonthOwnMonwy=0;
    if(mouthGap[moneyKey]){//如果某月没有销售，获取连续几个月没有销
      var gap = util.getIntervalMonth(new Date(mouthGap[moneyKey]),new Date(data[i].bd))-1;
      frontMonthOwnMonwy = mouthGap[moneyKey+"ownMoney"]*gap*data[i].hb_floating_rate/100;
    }
    mouthGap[moneyKey]=data[i].bd;
    mouthGap[moneyKey+"ownMoney"]=data[i].ownMoney;
    data[i].profit = rgptTemp - data[i].sm*data[i].hb_fixed_rate/100 - data[i].ownMoney*data[i].hb_floating_rate/100 - frontMonthOwnMonwy;
    data[i].profit = Math.round(data[i].profit*100)/100;
    //商务提成系统
    data[i].profitCoefficient = Math.round(data[i].profit/data[i].sm*10000)/100;
    account.smAccount+=data[i].sm;
    account.rgpAccount+=data[i].rgp;
    account.rgptAccount+=data[i].rgpt;
    account.profitAccount+=data[i].profit;
  }
  account.smAccount=Math.round(account.smAccount*100)/100;
  account.rgpAccount=Math.round(account.rgpAccount*100)/100;
  account.rgptAccount=Math.round(account.rgptAccount*100)/100;
  account.profitAccount=Math.round(account.profitAccount*100)/100;
  return {
    data:data,
    account:account
  };
}
module.exports = router;
