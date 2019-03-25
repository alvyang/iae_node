var express = require("express");
var logger = require('../utils/logger');
var util= require('../utils/global_util.js');
var router = express.Router();

//计算方差，标准差，来获取偏离程度，统计产品销售是否稳定
router.post("/getSaleVariance",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",99,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  getSaleVariance(req).then(data => {
    var date = new Date();
    date.setMonth(date.getMonth()-1,1);
    var d = util.getnMonth(12,date);
    //计算方差
    for(var i = 0 ; i < data.length;i++){
      culVariance(data[i],d)
    }
    selectSortVariance(data);
    res.json({"code":"000000",message:{data:data,time:d}});
  });
});
//选择排序
function selectSortVariance(arr){
    for(var i=0;i<arr.length;i++){
        //设置当前范围最小值和索引
        var min = arr[i];
        var minIndex = i;
        //在该范围选出最小值
        for(var j=i+1;j<arr.length;j++){
            if(min.continuity>arr[j].continuity){
                min = arr[j];
                minIndex = j;
            }
        }
        //将最小值插入,并将原来位置的最小值删除
        arr.splice(i,0,min);
        arr.splice(minIndex+1,1);
    }
    return arr.reverse();
}
//计算方式
function culVariance(data,d){
  var cum = 0;//累计
  var saleMoney = [];
  for(var i = 0 ; i < d.length;i++){
    cum += data[d[i]]/100;
    saleMoney.push(data[d[i]]);
  }
  var avg = cum/12;
  var s = 0;
  var continuity1=0,continuity2=0;//continuity1  值大于0的个数   continuity2等于0的个数
  for(var j = 0 ; j < saleMoney.length;j++){
    saleMoney[j]>0?continuity1++:continuity2++;
    s+=(saleMoney[j]/100-avg)*(saleMoney[j]/100-avg);
  }
  continuity1=continuity1==0?1:continuity1;
  continuity2=continuity2==0?1:continuity2;
  data.variance = Math.sqrt(s/12);
  data.variance = Math.round(Math.sqrt(s/12)*100)/100;
  data.continuity = Math.round(continuity1*100/continuity2)/100;
}
function getSaleVariance(req){
  //查询近12个月日期
  var dataSql = "select @rownum :=@rownum + 1 AS num,date_format(DATE_SUB(now(),INTERVAL @rownum MONTH),'%Y-%m') AS all_day "+
                "FROM (SELECT @rownum := 0) AS r_init,(select * from sales s limit 12) as c_init";
  var data = new Date();
  data.setMonth(data.getMonth()-1,1);
  var d = util.getnMonth(12,data);
  //以药品信息，及日期分组查询出销售数据
  var saleSql = "select DATE_FORMAT(s.bill_date,'%Y-%m') bd,d.product_common_name,d.product_specifications,d.product_makesmakers,sum(s.sale_money) sm,sum(s.sale_num) sn from sales s left join drugs d on s.product_code = d.product_code "+
            "where s.group_id='"+req.session.user[0].group_id+"' and s.delete_flag='0' and d.group_id='"+req.session.user[0].group_id+"' and d.delete_flag='0'"+
            " and DATE_FORMAT(s.bill_date,'%Y-%m') >= '"+d[11]+"' and DATE_FORMAT(s.bill_date,'%Y-%m') <= '"+d[0]+"' ";
  if(req.body.data.hospitalsId){
    saleSql += " and s.hospital_id = '"+req.body.data.hospitalsId+"' ";
  }
  if(req.body.data.business){
    saleSql += " and d.product_business = '"+req.body.data.business+"' ";
  }
  if(req.body.data.productCommonName){
    saleSql += " and d.product_common_name like '%"+req.body.data.productCommonName+"%' ";
  }
  if(req.body.data.product_makesmakers){
    saleSql += " and d.product_makesmakers like '%"+req.body.data.product_makesmakers+"%' ";
  }
  if(req.body.data.product_distribution_flag){
    saleSql += " and d.product_distribution_flag = '"+req.body.data.product_distribution_flag+"' ";
  }
  saleSql += "group by d.product_common_name,d.product_specifications,d.product_makesmakers,DATE_FORMAT(s.bill_date,'%Y-%m')";
  //以药品为左表，查出想对应的月销售数据，这样做目的是，同时，查出没有销售的药品数据
  var sql = "select ds.product_common_name,ds.product_specifications,ds.product_makesmakers,";
  for(var i = 0 ; i < d.length;i++){
    sql+=" Max(case sd.all_day when '"+d[i]+"' then s2.sn else 0 end ) '"+d[i]+"',";
  }
  sql = sql.substring(0,sql.length-1);
  sql += " from drugs ds left join ("+saleSql+") s2 on ds.product_common_name = s2.product_common_name and ds.product_specifications = s2.product_specifications "+
        "and ds.product_makesmakers = s2.product_makesmakers "+
        "left join ("+dataSql+") sd on s2.bd = sd.all_day "+
        "where ds.group_id='"+req.session.user[0].group_id+"' and ds.delete_flag='0' ";
  if(req.body.data.business){
    sql += " and ds.product_business = '"+req.body.data.business+"' ";
  }
  if(req.body.data.productCommonName){
    sql += " and ds.product_common_name like '%"+req.body.data.productCommonName+"%' ";
  }
  if(req.body.data.product_makesmakers){
    sql += " and ds.product_makesmakers like '%"+req.body.data.product_makesmakers+"%' ";
  }
  if(req.body.data.product_distribution_flag){
    sql += " and ds.product_distribution_flag = '"+req.body.data.product_distribution_flag+"' ";
  }
  sql += " group by ds.product_common_name,ds.product_specifications,ds.product_makesmakers";
  return new Promise((resolve, reject) => {//查询所有药品编码
    var sales = DB.get("Sales");
    sales.executeSql(sql,function(err,r){
      resolve(r);
    });
  });
}
//产品同比分析
router.post("/getSaleOnYear",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",99,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  getSaleOnYear(req).then(data => {
    //获取同比的时间 同比选择三年内 当月 前月  后一个月的时间  9个月的统计
    var gd = getOnYearDate();
    var d = gd.date;
    var ms = gd.month;
    for(var i = 0 ; i < data.length;i++){
      var key = data[i].key.split("::-::");
      data[i].product_common_name = key[0];
      data[i].product_specifications = key[1];
      data[i].product_makesmakers = key[3];
      for(var m in data[i]){
        data[i]['sum']=data[i]['sum']?data[i]['sum']:0;
        for(var j = 0 ; j < d.length ; j++){
          if(m == d[j].time){
            var value = req.body.type=="sn"?data[i][d[j].time+'sn']:data[i][d[j].time];
            data[i]['sum'] += parseFloat(value);
          }
        }
      }
      data[i]['sum'] = Math.round(data[i]['sum']*100)/100;
    }
    data = selectSort(data);
    res.json({"code":"000000",message:{
      data:data,
      month:ms.reverse(),
      time:gd.date.reverse()
    }});
  });
});
function getSaleOnYear(req){
  //获取同比的时间 同比选择三年内 当月 前月  后一个月的时间  9个月的统计
  var date = getOnYearDate();
  var saleSql = "select DATE_FORMAT(s.bill_date,'%Y-%m') bd,d.product_common_name,d.product_specifications,d.product_makesmakers,sum(s.sale_money) sm,sum(s.sale_num) sn from sales s left join drugs d on s.product_code = d.product_code "+
            "where s.group_id='"+req.session.user[0].group_id+"' and s.delete_flag='0' and d.group_id='"+req.session.user[0].group_id+"' and d.delete_flag='0'"+
            " and DATE_FORMAT(s.bill_date,'%Y-%m') in ("+date.dateStr+") ";
  if(req.body.data.hospitalsId){
    saleSql += " and s.hospital_id = '"+req.body.data.hospitalsId+"' ";
  }
  if(req.body.data.business){
    saleSql += " and d.product_business = '"+req.body.data.business+"' ";
  }
  if(req.body.data.productCommonName){
    saleSql += " and d.product_common_name like '%"+req.body.data.productCommonName+"%' ";
  }
  if(req.body.data.product_makesmakers){
    saleSql += " and d.product_makesmakers like '%"+req.body.data.product_makesmakers+"%' ";
  }
  if(req.body.data.product_distribution_flag){
    saleSql += " and d.product_distribution_flag = '"+req.body.data.product_distribution_flag+"' ";
  }
  saleSql += "group by d.product_common_name,d.product_specifications,d.product_makesmakers,DATE_FORMAT(s.bill_date,'%Y-%m')";
  var sql = "select ds.product_common_name,ds.product_specifications,ds.product_makesmakers,s2.bd,s2.sm,s2.sn from drugs ds left join ("+saleSql+") s2 on ds.product_common_name = s2.product_common_name and ds.product_specifications = s2.product_specifications "+
            "and ds.product_makesmakers = s2.product_makesmakers "+
            "where ds.group_id='"+req.session.user[0].group_id+"' and ds.delete_flag='0' ";
  if(req.body.data.business){
    sql += " and ds.product_business = '"+req.body.data.business+"' ";
  }
  if(req.body.data.productCommonName){
    sql += " and ds.product_common_name like '%"+req.body.data.productCommonName+"%' ";
  }
  if(req.body.data.product_makesmakers){
    sql += " and ds.product_makesmakers like '%"+req.body.data.product_makesmakers+"%' ";
  }
  if(req.body.data.product_distribution_flag){
    sql += " and ds.product_distribution_flag = '"+req.body.data.product_distribution_flag+"' ";
  }
  return new Promise((resolve, reject) => {//查询所有药品编码
    var sales = DB.get("Sales");
    sales.executeSql(sql,function(err,r){
      var data = [];
      for(var i = 0 ; i < r.length; i++){
        var temp = {};
        var pFlag = true;
        var key = r[i].product_common_name+"::-::"+r[i].product_specifications+"::-::"+r[i].product_unit+"::-::"+r[i].product_makesmakers;
        for(var j = 0 ; j<data.length;j++){
          if(data[j].key == key){
            pFlag = false;
            data[j][r[i].bd]=r[i].sm;
            data[j][r[i].bd+'sn']=r[i].sn;
          }
        }
        if(pFlag){
          temp.key = key;
          temp[r[i].bd] = r[i].sm;
          temp[r[i].bd+'sn'] = r[i].sn;
          data.push(temp);
        }
      }
      resolve(data);
    });
  });
}
//获取 同比时间
function getOnYearDate(){
  var date = [];
  var dateStr="";
  var ms=[];
  var now = new Date();
  var year = now.getFullYear();
  var month = now.getMonth();
  for(var i = -1 ; i < 2;i++){
    var m = month-i+1;
    m = m>9?m:"0"+m;
    ms.push(m);
    for(var j = 0 ; j < 3;j++){
      now.setFullYear(year-j,month-i,1);
      var temp = now.format("yyyy-MM");
      date.push({
        time:temp,
        year:temp.split("-")[0],
        month:temp.split("-")[1]
      });
      dateStr+="'"+temp+"',";
    }
  }
  return {
    date:date,
    month:ms,
    dateStr:dateStr.substring(0,dateStr.length-1)
  };
}
//产品环比分析
router.post("/getReportSaleChainRatio",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",99,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  getSaleAble(req).then(data => {
    var d = util.getnMonth(12,new Date());
    for(var i = 0 ; i < data.length;i++){
      var key = data[i].key.split("::-::");
      data[i].product_common_name = key[0];
      data[i].product_specifications = key[1];
      data[i].product_makesmakers = key[3];
      for(var m in data[i]){
        data[i]['sum']=data[i]['sum']?data[i]['sum']:0;
        for(var j = 0 ; j < d.length ; j++){
          if(m == d[j]){
            var value = req.body.type=="sn"?data[i][d[j]+'sn']:data[i][d[j]];
            data[i]['sum'] += parseFloat(value);
          }
        }
      }
      data[i]['sum'] = Math.round(data[i]['sum']*100)/100;
    }
    data = selectSort(data);
    res.json({"code":"000000",message:{
      data:data,
      time:d.reverse()
    }});
  });
});
//选择排序
function selectSort(arr){
    for(var i=0;i<arr.length;i++){
        //设置当前范围最小值和索引
        var min = arr[i];
        var minIndex = i;
        //在该范围选出最小值
        for(var j=i+1;j<arr.length;j++){
            if(min.sum>arr[j].sum){
                min = arr[j];
                minIndex = j;
            }
        }
        //将最小值插入,并将原来位置的最小值删除
        arr.splice(i,0,min);
        arr.splice(minIndex+1,1);
    }
    return arr.reverse();
}
function getSaleAble(req){
  var d = util.getnMonth(12,new Date());
  var saleSql = "select DATE_FORMAT(s.bill_date,'%Y-%m') bd,d.product_common_name,d.product_specifications,d.product_makesmakers,sum(s.sale_money) sm,sum(s.sale_num) sn from sales s left join drugs d on s.product_code = d.product_code "+
            "where s.group_id='"+req.session.user[0].group_id+"' and s.delete_flag='0' and d.group_id='"+req.session.user[0].group_id+"' and d.delete_flag='0'"+
            " and DATE_FORMAT(s.bill_date,'%Y-%m') >= '"+d[11]+"' and DATE_FORMAT(s.bill_date,'%Y-%m') <= '"+d[0]+"' ";
  if(req.body.data.hospitalsId){
    saleSql += " and s.hospital_id = '"+req.body.data.hospitalsId+"' ";
  }
  if(req.body.data.business){
    saleSql += " and d.product_business = '"+req.body.data.business+"' ";
  }
  if(req.body.data.productCommonName){
    saleSql += " and d.product_common_name like '%"+req.body.data.productCommonName+"%' ";
  }
  if(req.body.data.product_makesmakers){
    saleSql += " and d.product_makesmakers like '%"+req.body.data.product_makesmakers+"%' ";
  }
  if(req.body.data.product_distribution_flag){
    saleSql += " and d.product_distribution_flag = '"+req.body.data.product_distribution_flag+"' ";
  }
  saleSql += "group by d.product_common_name,d.product_specifications,d.product_makesmakers,DATE_FORMAT(s.bill_date,'%Y-%m')";
  var sql = "select ds.product_common_name,ds.product_specifications,ds.product_makesmakers,s2.bd,s2.sm,s2.sn from drugs ds left join ("+saleSql+") s2 on ds.product_common_name = s2.product_common_name and ds.product_specifications = s2.product_specifications "+
            "and ds.product_makesmakers = s2.product_makesmakers "+
            "where ds.group_id='"+req.session.user[0].group_id+"' and ds.delete_flag='0' ";
  if(req.body.data.business){
    sql += " and ds.product_business = '"+req.body.data.business+"' ";
  }
  if(req.body.data.productCommonName){
    sql += " and ds.product_common_name like '%"+req.body.data.productCommonName+"%' ";
  }
  if(req.body.data.product_makesmakers){
    sql += " and ds.product_makesmakers like '%"+req.body.data.product_makesmakers+"%' ";
  }
  if(req.body.data.product_distribution_flag){
    sql += " and ds.product_distribution_flag = '"+req.body.data.product_distribution_flag+"' ";
  }
  return new Promise((resolve, reject) => {//查询所有药品编码
    var sales = DB.get("Sales");

    sales.executeSql(sql,function(err,r){
      var data = [];
      for(var i = 0 ; i < r.length; i++){
        var temp = {};
        var pFlag = true;
        var key = r[i].product_common_name+"::-::"+r[i].product_specifications+"::-::"+r[i].product_unit+"::-::"+r[i].product_makesmakers;
        for(var j = 0 ; j<data.length;j++){
          if(data[j].key == key){
            pFlag = false;
            data[j][r[i].bd]=r[i].sm;
            data[j][r[i].bd+'sn']=r[i].sn;
          }
        }
        if(pFlag){
          temp.key = key;
          temp[r[i].bd] = r[i].sm;
          temp[r[i].bd+'sn'] = r[i].sn;
          data.push(temp);
        }
      }
      resolve(data);
    });
  });
}
//查询利润负债，综合查询
router.post("/getReportComprehensive",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",99,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  getComprehensive(req).then(data => {
    //销售表，综合统计回款情况，销售情况，库存负债情况
    var result = getGroupData(data);
    //调货相关数据
    getAllotComprehensive(req,result).then(data=>{
      res.json({"code":"000000",message:data});
      // //备货相关数据
      // getPurchaseComprehensive(req,data).then(data=>{
      //
      // });
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
            data[j].apurchaseReturnMoney1=data[j].apurchaseReturnMoney1?data[j].apurchaseReturnMoney1:0;//采进已回款
            data[j].apurchaseReturnMoney1+=result[i].refunds_real_money?parseFloat(result[i].refunds_real_money):0;
          }
          if(result[i].refunds_real_money && result[i].refunds_real_time && data[j].time == purchaseTime){
            data[j].apurchaseReturnMoney0=data[j].apurchaseReturnMoney0?data[j].apurchaseReturnMoney0:0;//采进未回款
            data[j].apurchaseReturnMoney0+=result[i].refunds_real_money?parseFloat(result[i].refunds_real_money):0;
          }else if(result[i].make_money_time && data[j].time == purchaseTime){
            data[j].npurchaseReturnMoney0=data[j].npurchaseReturnMoney0?data[j].npurchaseReturnMoney0:0;//采进未回款
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
          if(data[j].time == allotTime){
            data[j].allotReturnMoney=data[j].allotReturnMoney?data[j].allotReturnMoney:0;//调货应付款
            data[j].allotReturnMoney+=result[i].allot_return_money?parseFloat(result[i].allot_return_money):0;
          }
          if(result[i].allot_real_return_money > 0 && result[i].allot_return_time && data[j].time == allotTime){
            data[j].allotReturnMoney0=data[j].allotReturnMoney0?data[j].allotReturnMoney0:0;//调货已付款
            data[j].allotReturnMoney0+=result[i].allot_return_money?parseFloat(result[i].allot_return_money):0;
          }else if(data[j].time == allotTime){
            data[j].allotReturnMoney1=data[j].allotReturnMoney1?data[j].allotReturnMoney1:0;//调货未付款
            data[j].allotReturnMoney1+=result[i].allot_return_money?parseFloat(result[i].allot_return_money):0;
          }
        }
      }
      for(var i = 0 ; i < data.length;i++){
        data[i].allotReturnMoney=Math.round(data[i].allotReturnMoney*100)/100;
        data[i].allotReturnMoney0=Math.round(data[i].allotReturnMoney0*100)/100;
        data[i].allotReturnMoney1=Math.round(data[i].allotReturnMoney1*100)/100;
      }
      resolve(data);
    });
  });
}
//将查询出的数据，进行拼接
function getGroupData(data){
  var rd={};
  var st = "";
  var d = data.d;
  for(var i = 0 ; i < d.length;i++){
    rd[d[i].all_day]=rd[d[i].all_day]?rd[d[i].all_day]:{};
    // var temp = new Date(d[i].sale_return_time).format("yyyy-MM");
    rd[d[i].all_day].saleMoney = rd[d[i].all_day].saleMoney?rd[d[i].all_day].saleMoney:0;
    rd[d[i].all_day].saleMoney += parseFloat(d[i].sale_money);//销售总额

    if(d[i].sale_policy_money){
      rd[d[i].all_day].sReturnMoney0 = rd[d[i].all_day].sReturnMoney0?rd[d[i].all_day].sReturnMoney0:0//应付
      rd[d[i].all_day].sReturnMoney0 += d[i].sale_return_money?parseFloat(d[i].sale_return_money):0;//应付
    }
    if(d[i].sale_return_time && d[i].sale_policy_money){//销售已付款金额
      rd[d[i].all_day].aReturnMoney0 = rd[d[i].all_day].aReturnMoney0?rd[d[i].all_day].aReturnMoney0:0//已付
      rd[d[i].all_day].aReturnMoney0 += d[i].sale_return_money?parseFloat(d[i].sale_return_money):0;//已付
    }else if(d[i].sale_policy_money){//销售未付金额
      rd[d[i].all_day].nReturnMoney0 = rd[d[i].all_day].nReturnMoney0?rd[d[i].all_day].nReturnMoney0:0//未付
      rd[d[i].all_day].nReturnMoney0 += d[i].sale_return_money?parseFloat(d[i].sale_return_money):0;//未付
    }
    if(d[i].product_type == "高打"){
      rd[d[i].all_day].saleMoney0 = rd[d[i].all_day].saleMoney0?rd[d[i].all_day].saleMoney0:0;//高打销售额
      rd[d[i].all_day].saleMoney0 += parseFloat(d[i].sale_money);//高打销售额
    } else if (d[i].product_type == "佣金"){
      rd[d[i].all_day].saleMoney1 = rd[d[i].all_day].saleMoney1?rd[d[i].all_day].saleMoney1:0;//佣金销售额
      rd[d[i].all_day].saleMoney1 += parseFloat(d[i].sale_money);//佣金销售额
    } else {
      rd[d[i].all_day].saleMoney2 = rd[d[i].all_day].saleMoney2?rd[d[i].all_day].saleMoney2:0;//其它销售额
      rd[d[i].all_day].saleMoney2 += parseFloat(d[i].sale_money);//其它销售额
    }
    if(d[i].sale_return_flag == '1'){//按销售返款
      rd[d[i].all_day].arefundsMoney1 = rd[d[i].all_day].arefundsMoney1?rd[d[i].all_day].arefundsMoney1:0;//上游返利  应收金额
      rd[d[i].all_day].arefundsMoney1 += d[i].refunds_should_money?parseFloat(d[i].refunds_should_money):0;
      if(d[i].refunds_real_money && d[i].refunds_real_time){
        rd[d[i].all_day].refundsMoney1 = rd[d[i].all_day].refundsMoney1?rd[d[i].all_day].refundsMoney1:0;//上游返利  实收金额
        rd[d[i].all_day].refundsMoney1 += d[i].refunds_real_money?parseFloat(d[i].refunds_real_money):0;
      }else{
        rd[d[i].all_day].srefundsMoney1 = rd[d[i].all_day].srefundsMoney1?rd[d[i].all_day].srefundsMoney1:0;//上游返利  未收金额
        rd[d[i].all_day].srefundsMoney1 += d[i].refunds_should_money?parseFloat(d[i].refunds_should_money):0;
      }
    }else if(d[i].sale_return_flag == '2'){//按采进记录返
      //将采购返款，应收积分折算到销售中
      d[i].refunds_should_money2=d[i].refunds_should_money2?parseFloat(d[i].refunds_should_money2):0;
      var salePurchaseMoney = d[i].refunds_should_money2*d[i].sale_num/d[i].purchase_number;
      //将采购返款，实收积分折算到销售中
      d[i].refunds_real_money2=d[i].refunds_real_money2?parseFloat(d[i].refunds_real_money2):0;
      var saleRealPurchaseMoney = d[i].refunds_real_money2*d[i].sale_num/d[i].purchase_number;

      rd[d[i].all_day].arefundsMoney2 = rd[d[i].all_day].arefundsMoney2?rd[d[i].all_day].arefundsMoney2:0;//上游返利  应收金额
      if(d[i].purchase_number){
        rd[d[i].all_day].arefundsMoney2 += salePurchaseMoney;
      }
      rd[d[i].all_day].refundsMoney2 = rd[d[i].all_day].refundsMoney2?rd[d[i].all_day].refundsMoney2:0;//上游返利  实收金额
      rd[d[i].all_day].srefundsMoney2 = rd[d[i].all_day].srefundsMoney2?rd[d[i].all_day].srefundsMoney2:0;//上游返利  未收金额

      if(d[i].refunds_real_money2 && d[i].refunds_real_time2){//已返
        rd[d[i].all_day].refundsMoney2 += saleRealPurchaseMoney;
      }else if(d[i].purchase_number){
        rd[d[i].all_day].srefundsMoney2 += salePurchaseMoney;
      }
    }
  }

  var rdTemp = [];
  for(var key in rd){
    rdTemp.push({
      time:key,
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
  //stockSql  查询的是，高打药品库存里还有多少库存，并计算，库存积分
  var stockSql = "select sum(if(r.refunds_real_money is null or r.refunds_real_money = '',r.refunds_should_money*bs.batch_stock_number/p.purchase_number,r.refunds_real_money*bs.batch_stock_number/p.purchase_number)) stockMoney from batch_stock bs "+
                 "left join purchase p on bs.batch_stock_purchase_id = p.purchase_id "+
                 "left join refunds r on bs.batch_stock_purchase_id = r.purchases_id "+
                 "where bs.tag_type_delete_flag = '0' and bs.tag_type_group_id = '"+req.session.user[0].group_id+"' and p.make_money_time is not null";

  //销售查询
  var sql = "select s.*,rs.*,rs1.refunds_should_money as refunds_should_money2,rs1.refunds_real_money as refunds_real_money2,"+
            "rs1.refunds_real_time as refunds_real_time2,rs1.receiver as receiver2,"+
            "sp.*,ps.purchase_number,d.product_type from sales s left join drugs d on s.product_code = d.product_code "+
            "left join purchase ps on ps.purchase_id = s.sales_purchase_id "+
            "left join refunds rs on rs.sales_id = s.sale_id "+
            "left join refunds rs1 on ps.purchase_id = rs1.purchases_id "+
            "left join sale_policy sp on s.hospital_id = sp.sale_hospital_id and d.product_id = sp.sale_drug_id "+
            "where s.delete_flag='0' and s.group_id = '"+req.session.user[0].group_id+"' "+
            "and d.delete_flag='0' and d.group_id = '"+req.session.user[0].group_id+"'";
  if(req.body.hospitalsId){
    sql+="and s.hospital_id = '"+req.body.hospitalsId+"' ";
  }
  if(req.body.business){
    sql+="and d.product_business = '"+req.body.business+"' ";
  }
  //查询近12个月日期
  var dataSql = "select @rownum :=@rownum + 1 AS num,date_format(DATE_SUB(now(),INTERVAL @rownum MONTH),'%Y-%m') AS all_day "+
                "FROM (SELECT @rownum := -1) AS r_init,(select * from sales s limit 24) as c_init";

  var rSql = "select * from ("+dataSql+") t1 left join ("+sql+") t2 on t1.all_day = DATE_FORMAT(t2.bill_date,'%Y-%m') order by t1.all_day desc";
  return new Promise((resolve, reject) => {//查询所有药品编码{
    var sales = DB.get("Sales");
    sales.executeSql(rSql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "综合查询，查询销售额，销售回积分出错" + err);
      }
      sales.executeSql(stockSql,function(err,stockMoney){
        if(err){
          logger.error(req.session.user[0].realname + "综合查询，查询销售额，销售回积分出错" + err);
        }
        resolve({
          d:result,
          stockMoney:stockMoney[0].stockMoney
        });
      });
    });
  });
}
//查询销售按真实毛利率
router.post("/getSalesByProfitRate",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",99,") < 0){
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
  if(req.session.user[0].authority_code.indexOf(",99,") < 0){
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
  if(req.session.user[0].authority_code.indexOf(",99,") < 0){
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
  if(req.body.data.product_distribution_flag){
    sql += " and d.product_distribution_flag = '"+req.body.data.product_distribution_flag+"' ";
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
  if(req.session.user[0].authority_code.indexOf(",99,") < 0){
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
  if(req.session.user[0].authority_code.indexOf(",99,") < 0){
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
  if(req.session.user[0].authority_code.indexOf(",99,") < 0){
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
  if(req.session.user[0].authority_code.indexOf(",99,") < 0){
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
