var express = require("express");
var logger = require('../utils/logger');
var util= require('../utils/global_util.js');
var nodeExcel = require('excel-export');
var parse = require('csv-parse');
var XLSX = require("xlsx");
var router = express.Router();

//导出
router.post("/exportReportPurchasePayComprehensive",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",99,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var findParam = JSON.stringify(req.body);
  req.body.data = JSON.parse(findParam);
  var purchasePaySql = getReportComprehensiveSql(req,res);
  var purchasePay = DB.get("PurchasePay");
  purchasePay.executeSql(purchasePaySql,function(err,r){
    var conf ={};
    conf.stylesXmlFile = "./utils/styles.xml";
    conf.name = "mysheet";
    conf.cols = [{
        caption:'打款日期',
        type:'string',
        beforeCellWrite:function(row, cellData){
          return new Date(cellData).format('yyyy-MM');
        }
    },{caption:'应收积分',type:'number',
      beforeCellWrite:function(row, cellData){
        return !util.isEmpty(cellData)?cellData:0;
      }
    },{caption:'实收积分',type:'number',
      beforeCellWrite:function(row, cellData){
        return !util.isEmpty(cellData)?cellData:0;
      }
    },{caption:'未收积分',type:'number',
      beforeCellWrite:function(row, cellData){
        var t1 = !util.isEmpty(row[1])?row[1]:0;
        var t2 = !util.isEmpty(row[2])?row[2]:0;
        var t3 = t1 - t2 ;
        t3 = Math.round(t3*100)/100;
        return t3;

        return cellData?cellData:0;
      }
    },{caption:'应付积分',type:'number',
      beforeCellWrite:function(row, cellData){
        return !util.isEmpty(cellData)?cellData:0;
      }
    },{caption:'实付积分',type:'number',
      beforeCellWrite:function(row, cellData){
        return !util.isEmpty(cellData)?cellData:0;
      }
    },{caption:'未付积分',type:'number',
      beforeCellWrite:function(row, cellData){
        var t1 = !util.isEmpty(row[4])?row[4]:0;
        var t2 = !util.isEmpty(row[5])?row[5]:0;
        var t3 = t1 - t2 ;
        t3 = Math.round(t3*100)/100;
        return t3;
      }
    },{caption:'利润',type:'number',
      beforeCellWrite:function(row, cellData){
        var t1 = !util.isEmpty(row[1])?row[1]:0;
        var t2 = !util.isEmpty(row[4])?row[4]:0;
        var t3 = t1 - t2 ;
        t3 = Math.round(t3*100)/100;
        return t3;
      }
    },{caption:'真实利润',type:'number',
      beforeCellWrite:function(row, cellData){
        var t1 = !util.isEmpty(row[2])?row[2]:0;
        var t2 = !util.isEmpty(row[5])?row[5]:0;
        var t3 = t1 - t2 ;
        t3 = Math.round(t3*100)/100;
        return t3;
      }
    }];
    var header = ['all_day','ppsm','pprm', '','ppspm','pprpm', ''];
    conf.rows = util.formatExcel(header,r);
    var result = nodeExcel.execute(conf);
    var message = req.session.user[0].realname+"导出预付报表。"+conf.rows.length+"条";
    util.saveLogs(req.session.user[0].group_id,"-",findParam,message);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats');
    res.setHeader("Content-Disposition", "attachment; filename=" + "Report.xlsx");
    res.end(result, 'binary');
  });
});
//获取招商预付 应收  应付统计
router.post("/getReportPurchasePayComprehensive",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",99,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var purchasePaySql = getReportComprehensiveSql(req,res);
  var purchasePay = DB.get("PurchasePay");
  purchasePay.executeSql(purchasePaySql,function(err,r){
    res.json({"code":"000000",message:r});
  });
});
function getReportComprehensiveSql(req,res){
  //查询近12个月日期
  var dataSql = "select @rownum :=@rownum + 1 AS num,date_format(DATE_SUB(now(),INTERVAL @rownum MONTH),'%Y-%m') AS all_day "+
                "FROM (SELECT @rownum := -1) AS r_init,(select * from sales s limit 24) as c_init";

  var sql = "select DATE_FORMAT(p.purchase_pay_time,'%Y-%m') purchase_pay_time,sum(purchase_pay_should_money) ppsm,sum(purchase_pay_real_money) pprm,sum(purchase_pay_should_pay_money) ppspm,sum(purchase_pay_real_pay_money) pprpm "+
            "from purchase_pay p where p.purchase_pay_delete_flag = '0' and p.purchase_pay_group_id = '"+req.session.user[0].group_id+"' ";
  if(req.body.business){
    sql += " and p.purchase_pay_business_id = '"+req.body.business+"' ";
  }
  if(req.body.contactId){
    sql += " and p.purchase_pay_contact_id = '"+req.body.contactId+"' ";
  }
  sql += "group by DATE_FORMAT(p.purchase_pay_time,'%Y-%m') ";

  var purchasePaySql = "select * from ("+dataSql+") t1 left join ("+sql+") t2 on t1.all_day = t2.purchase_pay_time order by t1.all_day desc";

  return purchasePaySql;
}

//计算方差，标准差，来获取偏离程度，统计产品销售是否稳定
router.post("/getSaleVariance",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",99,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  getSaleVariance(req).then(data => {
    var date = new Date();
    // date.setMonth(date.getMonth()-1,1);
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
  //continuity2 记录不连续的次数 , continuity3 记录连续次数 continuity4 12个月连续长度
  var continuity2=0,continuity3=0,continuity4=[];
  saleMoney.reverse();
  for(var j = 0 ; j < saleMoney.length;j++){
    if(saleMoney[j]>0){
      continuity3++;
      continuity2<0?continuity4.push(continuity2):continuity4.push(0);
      continuity2=0;
    }else{
      continuity2--;
      continuity3>0?continuity4.push(continuity3):continuity4.push(0);
      continuity3=0;
    }
    if(j == saleMoney.length - 1){
      continuity2<0?continuity4.push(continuity2):"";
      continuity3>0?continuity4.push(continuity3):"";
    }
    s+=(saleMoney[j]/100-avg)*(saleMoney[j]/100-avg);
  }
  continuity4.splice(0,1);
  var con = 0;
  for(var m = continuity4.length-1 ; m > 0 ; m--){
    if(continuity4[m] > 0){
      con += continuity4[m] * (m+1)/12;
    }else{
      con += continuity4[m] * (m+1)/48;
    }

  }
  data.variance = Math.sqrt(s/12);
  data.variance = Math.round(Math.sqrt(s/12)*100)/100;
  data.continuity = Math.round(con*100)/100;
}
function getSaleVariance(req){
  //查询近12个月日期
  var dataSql = "select @rownum :=@rownum + 1 AS num,date_format(DATE_SUB(now(),INTERVAL @rownum MONTH),'%Y-%m') AS all_day "+
                "FROM (SELECT @rownum := -1) AS r_init,(select * from sales s limit 12) as c_init";
  var data = new Date();
  // data.setMonth(data.getMonth()-1,1);
  var d = util.getnMonth(12,data);
  //以药品信息，及日期分组查询出销售数据
  var saleSql = "select DATE_FORMAT(s.bill_date,'%Y-%m') bd,d.product_common_name,d.product_specifications,d.product_makesmakers,sum(s.sale_money) sm,sum(s.sale_num) sn from sales s left join drugs d on s.product_code = d.product_code "+
            "where s.group_id='"+req.session.user[0].group_id+"' and s.delete_flag='0' and d.group_id='"+req.session.user[0].group_id+"' and d.delete_flag='0'"+
            " and DATE_FORMAT(s.bill_date,'%Y-%m') >= '"+d[11]+"' and DATE_FORMAT(s.bill_date,'%Y-%m') <= '"+d[0]+"' ";
  if(!util.isEmpty(req.body.data.hospitalsId)){
    saleSql += " and s.hospital_id = '"+req.body.data.hospitalsId+"' ";
  }
  if(!util.isEmpty(req.body.data.business)){
    saleSql += " and d.product_business = '"+req.body.data.business+"' ";
  }
  if(!util.isEmpty(req.body.data.productCommonName)){
    saleSql += " and d.product_common_name like '%"+req.body.data.productCommonName+"%' ";
  }
  if(!util.isEmpty(req.body.data.product_makesmakers)){
    saleSql += " and d.product_makesmakers like '%"+req.body.data.product_makesmakers+"%' ";
  }
  if(!util.isEmpty(req.body.data.product_distribution_flag)){
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
  if(!util.isEmpty(req.body.data.business)){
    sql += " and ds.product_business = '"+req.body.data.business+"' ";
  }
  if(!util.isEmpty(req.body.data.productCommonName)){
    sql += " and ds.product_common_name like '%"+req.body.data.productCommonName+"%' ";
  }
  if(!util.isEmpty(req.body.data.product_makesmakers)){
    sql += " and ds.product_makesmakers like '%"+req.body.data.product_makesmakers+"%' ";
  }
  if(!util.isEmpty(req.body.data.product_distribution_flag)){
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
  if(!util.isEmpty(req.body.data.hospitalsId)){
    saleSql += " and s.hospital_id = '"+req.body.data.hospitalsId+"' ";
  }
  if(!util.isEmpty(req.body.data.business)){
    saleSql += " and d.product_business = '"+req.body.data.business+"' ";
  }
  if(!util.isEmpty(req.body.data.productCommonName)){
    saleSql += " and d.product_common_name like '%"+req.body.data.productCommonName+"%' ";
  }
  if(!util.isEmpty(req.body.data.product_makesmakers)){
    saleSql += " and d.product_makesmakers like '%"+req.body.data.product_makesmakers+"%' ";
  }
  if(!util.isEmpty(req.body.data.product_distribution_flag)){
    saleSql += " and d.product_distribution_flag = '"+req.body.data.product_distribution_flag+"' ";
  }
  saleSql += "group by d.product_common_name,d.product_specifications,d.product_makesmakers,DATE_FORMAT(s.bill_date,'%Y-%m')";
  var sql = "select ds.product_common_name,ds.product_specifications,ds.product_makesmakers,s2.bd,s2.sm,s2.sn from drugs ds left join ("+saleSql+") s2 on ds.product_common_name = s2.product_common_name and ds.product_specifications = s2.product_specifications "+
            "and ds.product_makesmakers = s2.product_makesmakers "+
            "where ds.group_id='"+req.session.user[0].group_id+"' and ds.delete_flag='0' ";
  if(!util.isEmpty(req.body.data.business)){
    sql += " and ds.product_business = '"+req.body.data.business+"' ";
  }
  if(!util.isEmpty(req.body.data.productCommonName)){
    sql += " and ds.product_common_name like '%"+req.body.data.productCommonName+"%' ";
  }
  if(!util.isEmpty(req.body.data.product_makesmakers)){
    sql += " and ds.product_makesmakers like '%"+req.body.data.product_makesmakers+"%' ";
  }
  if(!util.isEmpty(req.body.data.product_distribution_flag)){
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
  if(!util.isEmpty(req.body.data.hospitalsId)){
    saleSql += " and s.hospital_id = '"+req.body.data.hospitalsId+"' ";
  }
  if(!util.isEmpty(req.body.data.business)){
    saleSql += " and d.product_business = '"+req.body.data.business+"' ";
  }
  if(!util.isEmpty(req.body.data.productCommonName)){
    saleSql += " and d.product_common_name like '%"+req.body.data.productCommonName+"%' ";
  }
  if(!util.isEmpty(req.body.data.product_makesmakers)){
    saleSql += " and d.product_makesmakers like '%"+req.body.data.product_makesmakers+"%' ";
  }
  if(!util.isEmpty(req.body.data.product_distribution_flag)){
    saleSql += " and d.product_distribution_flag = '"+req.body.data.product_distribution_flag+"' ";
  }
  saleSql += "group by d.product_common_name,d.product_specifications,d.product_makesmakers,DATE_FORMAT(s.bill_date,'%Y-%m')";
  var sql = "select ds.product_common_name,ds.product_specifications,ds.product_makesmakers,s2.bd,s2.sm,s2.sn from drugs ds left join ("+saleSql+") s2 on ds.product_common_name = s2.product_common_name and ds.product_specifications = s2.product_specifications "+
            "and ds.product_makesmakers = s2.product_makesmakers "+
            "where ds.group_id='"+req.session.user[0].group_id+"' and ds.delete_flag='0' ";
  if(!util.isEmpty(req.body.data.business)){
    sql += " and ds.product_business = '"+req.body.data.business+"' ";
  }
  if(!util.isEmpty(req.body.data.productCommonName)){
    sql += " and ds.product_common_name like '%"+req.body.data.productCommonName+"%' ";
  }
  if(!util.isEmpty(req.body.data.product_makesmakers)){
    sql += " and ds.product_makesmakers like '%"+req.body.data.product_makesmakers+"%' ";
  }
  if(!util.isEmpty(req.body.data.product_distribution_flag)){
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
//导出
router.post("/exportReportComprehensive",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",99,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var findParam = JSON.stringify(req.body);
  req.body.data = JSON.parse(findParam);
  getComprehensive(req).then(data => {
    //销售表，综合统计回款情况，销售情况，库存负债情况
    var result = getGroupData(data);
    //调货相关数据
    getAllotComprehensive(req,result).then(data=>{
      var conf ={};
      conf.stylesXmlFile = "./utils/styles.xml";
      conf.name = "mysheet";
      conf.cols = [{
          caption:'日期',
          type:'string',
          beforeCellWrite:function(row, cellData){
            return new Date(cellData).format('yyyy-MM');
          }
      },{caption:'销售总额',type:'number',
        beforeCellWrite:function(row, cellData){
          return cellData?cellData:0;
        }
      },{caption:'高打销售额（销售）',type:'number',
        beforeCellWrite:function(row, cellData){
          return cellData?cellData:0;
        }
      },{caption:'高打销售占比（销售）',type:'string',
        beforeCellWrite:function(row, cellData){
          var percent = 0;
          if(!util.isEmpty(cellData) && !util.isEmpty(row[1])){
             percent = cellData/row[1];
          }
          return Math.round(percent*100)+"%";
        }
      },{caption:'高打应收积分（销售）',type:'number',
        beforeCellWrite:function(row, cellData){
          return cellData?cellData:0;
        }
      },{caption:'高打实收积分（销售）',type:'number',
        beforeCellWrite:function(row, cellData){
          return cellData?cellData:0;
        }
      },{caption:'高打实收占比（销售）',type:'string',
        beforeCellWrite:function(row, cellData){
          var percent = 0;
          if(!util.isEmpty(cellData) && !util.isEmpty(row[4])){
             percent = cellData/row[4];
          }
          return Math.round(percent*100)+"%";
        }
      },{caption:'高打未收积分（销售）',type:'number',
        beforeCellWrite:function(row, cellData){
          return cellData?cellData:0;
        }
      },{caption:'佣金销售额',type:'number',
        beforeCellWrite:function(row, cellData){
          return cellData?cellData:0;
        }
      },{caption:'佣金销售占比',type:'string',
        beforeCellWrite:function(row, cellData){
          var percent = 0;
          if(!util.isEmpty(cellData) && !util.isEmpty(row[1])){
             percent = cellData/row[1];
          }
          return Math.round(percent*100)+"%";
        }
      },{caption:'佣金应收积分',type:'number',
        beforeCellWrite:function(row, cellData){
          return cellData?cellData:0;
        }
      },{caption:'佣金实收积分',type:'number',
        beforeCellWrite:function(row, cellData){
          return cellData?cellData:0;
        }
      },{caption:'佣金实收占比',type:'string',
        beforeCellWrite:function(row, cellData){
          var percent = 0;
          if(!util.isEmpty(cellData) && !util.isEmpty(row[10])){
             percent = cellData/row[10];
          }
          return Math.round(percent*100)+"%";
        }
      },{caption:'佣金未收积分',type:'number',
        beforeCellWrite:function(row, cellData){
          return cellData?cellData:0;
        }
      },{caption:'高打应收积分（调货）',type:'number',
        beforeCellWrite:function(row, cellData){
          return cellData?cellData:0;
        }
      },{caption:'高打实收积分（调货）',type:'number',
        beforeCellWrite:function(row, cellData){
          return cellData?cellData:0;
        }
      },{caption:'高打实收占比（调货）',type:'string',
        beforeCellWrite:function(row, cellData){
          var percent = 0;
          if(!util.isEmpty(cellData) && !util.isEmpty(row[14])){
             percent = cellData/row[14];
          }
          return Math.round(percent*100)+"%";
        }
      },{caption:'高打未收积分（调货）',type:'number',
        beforeCellWrite:function(row, cellData){
          return cellData?cellData:0;
        }
      },{caption:'销售应付积分',type:'number',
        beforeCellWrite:function(row, cellData){
          return cellData?cellData:0;
        }
      },{caption:'销售实付积分',type:'number',
        beforeCellWrite:function(row, cellData){
          return cellData?cellData:0;
        }
      },{caption:'销售实付占比',type:'string',
        beforeCellWrite:function(row, cellData){
          var percent = 0;
          if(!util.isEmpty(cellData) && !util.isEmpty(row[19])){
             percent = cellData/row[19];
          }
          return Math.round(percent*100)+"%";
        }
      },{caption:'销售未付积分',type:'number',
        beforeCellWrite:function(row, cellData){
          return cellData?cellData:0;
        }
      },{caption:'调货应付积分',type:'number',
        beforeCellWrite:function(row, cellData){
          return cellData?cellData:0;
        }
      },{caption:'调货实付积分',type:'number',
        beforeCellWrite:function(row, cellData){
          return cellData?cellData:0;
        }
      },{caption:'调货实付占比',type:'string',
        beforeCellWrite:function(row, cellData){
          var percent = 0;
          if(!util.isEmpty(cellData) && !util.isEmpty(row[23])){
             percent = cellData/row[23];
          }
          return Math.round(percent*100)+"%";
        }
      },{caption:'调货未付积分',type:'number',
        beforeCellWrite:function(row, cellData){
          return cellData?cellData:0;
        }
      },{caption:'利润',type:'number',
        beforeCellWrite:function(row, cellData){
          row[4] = row[4]?parseFloat(row[4]):0;
          row[10] = row[10]?parseFloat(row[10]):0;
          row[14] = row[14]?parseFloat(row[14]):0;
          row[18] = row[18]?parseFloat(row[18]):0;
          row[22] = row[22]?parseFloat(row[22]):0;
          var m = row[4] + row[10] + row[14] - row[18] - row[22];
          console.log(row[4] + ":"+row[10] +":"+ row[14] +":"+ row[18] +":"+ row[22]);
          m = Math.round(m*100)/100;
          return m;
        }
      },{caption:'真实利润',type:'number',
        beforeCellWrite:function(row, cellData){
          row[5] = row[5]?parseFloat(row[5]):0;
          row[12] = row[12]?parseFloat(row[12]):0;
          row[16] = row[16]?parseFloat(row[16]):0;
          row[20] = row[20]?parseFloat(row[20]):0;
          row[24] = row[24]?parseFloat(row[24]):0;
          var n = row[5] + row[12] + row[16] - row[20] - row[24];
          n = Math.round(n*100)/100;
          return n;
        }
      }];
      var header = ['time', 'saleMoney','saleMoney0', 'saleMoney0', 'arefundsMoney2', 'refundsMoney2','refundsMoney2','srefundsMoney2',
                    'saleMoney1','saleMoney1','arefundsMoney1','refundsMoney1','refundsMoney1','srefundsMoney1','allotShouldReturn',
                    'allotRealReturn','allotRealReturn','allotNoReturn','sReturnMoney0','aReturnMoney0','aReturnMoney0',
                    'nReturnMoney0','allotReturnMoney','allotReturnMoney0','allotReturnMoney0','allotReturnMoney1','',''];
      conf.rows = util.formatExcel(header,data);
      var result = nodeExcel.execute(conf);
      var message = req.session.user[0].realname+"导出报表。"+conf.rows.length+"条";
      util.saveLogs(req.session.user[0].group_id,"-",findParam,message);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats');
      res.setHeader("Content-Disposition", "attachment; filename=" + "Report.xlsx");
      res.end(result, 'binary');
    });
  });
});
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
            "and p.purchase_return_flag='2' and r.refund_delete_flag = '0' ";
  if(req.body.makeMoneyFlag == "2"){
    sql += "and p.make_money_time is not null ";
  }
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
          if(!util.isEmpty(result[i].refunds_real_money) && result[i].refunds_real_time && result[i].receiver && data[j].time == temp){
            data[j].apurchaseReturnMoney1=data[j].apurchaseReturnMoney1?data[j].apurchaseReturnMoney1:0;//采进已回款
            data[j].apurchaseReturnMoney1+=result[i].refunds_real_money?parseFloat(result[i].refunds_real_money):0;
          }
          if(!util.isEmpty(result[i].refunds_real_money) && result[i].refunds_real_time && data[j].time == purchaseTime){
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
  var sql = "select a.*,p.purchase_number,r.refunds_should_money,r.refunds_real_money "+
            "from allot a left join purchase p on a.allot_purchase_id = p.purchase_id "+
            "left join drugs d on d.product_id = a.allot_drug_id "+
            "left join refunds r on r.purchases_id = p.purchase_id and r.refund_delete_flag = '0' "+
            "where a.allot_delete_flag = '0' and a.allot_group_id = '"+req.session.user[0].group_id+"' "+
            "and p.delete_flag = '0' and p.group_id = '"+req.session.user[0].group_id+"' ";
  if(req.body.hospitalsId){
    sql+="and a.allot_hospital = '"+req.body.hospitalsId+"' ";
  }
  if(req.body.business){
    sql+="and d.product_business = '"+req.body.business+"' ";
  }
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
        var allotTime = new Date(result[i].allot_time).format("yyyy-MM");
        for(var j = 0 ; j<data.length;j++){
          if(data[j].time == allotTime){
            data[j].allotReturnMoney=data[j].allotReturnMoney?data[j].allotReturnMoney:0;//调货应付款
            data[j].allotReturnMoney+=result[i].allot_return_money?parseFloat(result[i].allot_return_money):0;
          }
          if(!util.isEmpty(result[i].refunds_should_money) && !util.isEmpty(result[i].purchase_number) && data[j].time == allotTime){
            data[j].allotShouldReturn = data[j].allotShouldReturn?data[j].allotShouldReturn:0;
            data[j].allotShouldReturn += result[i].refunds_should_money*result[i].allot_number/result[i].purchase_number;
            if(!util.isEmpty(result[i].refunds_real_money) && result[i].refunds_real_money > 0){
              data[j].allotRealReturn = data[j].allotRealReturn?data[j].allotRealReturn:0;
              data[j].allotRealReturn += result[i].refunds_real_money*result[i].allot_number/result[i].purchase_number;
            }else{
              data[j].allotNoReturn = data[j].allotNoReturn?data[j].allotNoReturn:0;
              data[j].allotNoReturn += result[i].refunds_should_money*result[i].allot_number/result[i].purchase_number;
            }
          }
          if(result[i].allot_real_return_money > 0 && result[i].allot_return_time && data[j].time == allotTime){
            data[j].allotReturnMoney0=data[j].allotReturnMoney0?data[j].allotReturnMoney0:0;//调货已付款
            data[j].allotReturnMoney0+=result[i].allot_real_return_money?parseFloat(result[i].allot_real_return_money):0;
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
        data[i].allotShouldReturn=Math.round(data[i].allotShouldReturn*100)/100;
        data[i].allotRealReturn=Math.round(data[i].allotRealReturn*100)/100;
        data[i].allotNoReturn=Math.round(data[i].allotNoReturn*100)/100;
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

    if(!util.isEmpty(d[i].sale_return_money)){
      rd[d[i].all_day].sReturnMoney0 = rd[d[i].all_day].sReturnMoney0?rd[d[i].all_day].sReturnMoney0:0//应付
      rd[d[i].all_day].sReturnMoney0 += d[i].sale_return_money?parseFloat(d[i].sale_return_money):0;//应付
    }
    if(d[i].sale_return_time && !util.isEmpty(d[i].sale_return_money)){//销售已付款金额
      rd[d[i].all_day].aReturnMoney0 = rd[d[i].all_day].aReturnMoney0?rd[d[i].all_day].aReturnMoney0:0//已付
      rd[d[i].all_day].aReturnMoney0 += d[i].sale_return_real_return_money?parseFloat(d[i].sale_return_real_return_money):0;//已付
    }else if(!util.isEmpty(d[i].sale_return_money)){//销售未付金额
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
      if(!util.isEmpty(d[i].refunds_real_money) && d[i].refunds_real_time){
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
      if(!util.isEmpty(d[i].purchase_number)){
        rd[d[i].all_day].arefundsMoney2 += salePurchaseMoney;
      }
      rd[d[i].all_day].refundsMoney2 = rd[d[i].all_day].refundsMoney2?rd[d[i].all_day].refundsMoney2:0;//上游返利  实收金额
      rd[d[i].all_day].srefundsMoney2 = rd[d[i].all_day].srefundsMoney2?rd[d[i].all_day].srefundsMoney2:0;//上游返利  未收金额

      if(!util.isEmpty(d[i].refunds_real_money2) && d[i].refunds_real_time2){//已返
        rd[d[i].all_day].refundsMoney2 += saleRealPurchaseMoney;
      }else if(!util.isEmpty(d[i].purchase_number)){
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
      // stockMoneyReturn:Math.round(data.stockMoney*100)/100,
      saleMoney1:Math.round(rd[key].saleMoney1*100)/100,
      saleMoney2:Math.round(rd[key].saleMoney2*100)/100
    });
  }
  return rdTemp;
}
router.post("/getBatchStock",function(req,res){
  //stockSql  查询的是，高打药品库存里还有多少库存，并计算，库存积分
  //
  var stockSql = "select bs.*,d.*,b.business_name,r.refunds_real_money,r.refunds_should_money,p.purchase_number,"+
                 "if(r.refunds_real_money is null or r.refunds_real_money = '',r.refunds_should_money*bs.batch_stock_number/p.purchase_number,r.refunds_real_money*bs.batch_stock_number/p.purchase_number) debt,"+
                 "r.refunds_should_money*bs.batch_stock_number/p.purchase_number shouldReturn,"+
                 "r.refunds_real_money*bs.batch_stock_number/p.purchase_number realReturn "+
                 "from batch_stock bs "+
                 "left join drugs d on bs.batch_stock_drug_id = d.product_id "+
                 "left join purchase p on bs.batch_stock_purchase_id = p.purchase_id "+
                 "left join refunds r on bs.batch_stock_purchase_id = r.purchases_id "+
                 "left join business b on d.product_business = b.business_id "+
                 "where bs.tag_type_delete_flag = '0' and bs.tag_type_group_id = '"+req.session.user[0].group_id+"' "+
                 "and d.delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"' "+
                 "and bs.batch_stock_number != '0' ";
   if(!util.isEmpty(req.body.data.productCommonName)){
     stockSql += " and d.product_common_name like '%"+req.body.data.productCommonName+"%' ";
   }
   if(!util.isEmpty(req.body.data.product_code)){
     stockSql += " and d.product_code like '%"+req.body.data.product_code+"%' ";
   }

   var sales = DB.get("Sales");
   sales.countBySql(stockSql,function(err,result){//查询调货总数
     if(err){
       logger.error(req.session.user[0].realname + "查询库存负债总数出错" + err);
     }
     req.body.page.totalCount = result;
     req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
     var sumSql = "select sum(if(num.refunds_real_money is null or num.refunds_real_money = '',num.refunds_should_money*num.batch_stock_number/num.purchase_number,num.refunds_real_money*num.batch_stock_number/num.purchase_number)) stockMoney "+
                  "from ("+stockSql+") num ";
     sales.executeSql(sumSql,function(err,m){//查询调货应返金额
      if(err){
        logger.error(req.session.user[0].realname + "查询库存负债总额出错" + err);
      }
      req.body.page.numMoney = m&&m[0]?Math.round(m[0].stockMoney*100)/100:0;
      stockSql += "order by bs.batch_stock_time desc,d.product_create_time desc,bs.batch_stock_drug_id desc limit " + req.body.page.start + "," + req.body.page.limit + "";
      sales.executeSql(stockSql,function(err,result){
        if(err){
          logger.error(req.session.user[0].realname + "查询库存列表" + err);
        }
        req.body.page.data = result;
        res.json({"code":"000000",message:req.body.page});
      });
    });
   });
});
//查询佣金类型的各项数据   这个表里的sql，超级复杂
function getComprehensive(req){
  var noDate = new Date();
  //销售查询
  var sql = "select s.*,rs.*,rs1.refunds_should_money as refunds_should_money2,rs1.refunds_real_money as refunds_real_money2,"+
            "rs1.refunds_real_time as refunds_real_time2,rs1.receiver as receiver2,"+
            "sp.*,ps.purchase_number,d.product_type from sales s left join drugs d on s.product_code = d.product_code "+
            "left join purchase ps on ps.purchase_id = s.sales_purchase_id "+
            "left join refunds rs on rs.sales_id = s.sale_id and rs.refund_delete_flag = '0' "+
            "left join refunds rs1 on ps.purchase_id = rs1.purchases_id and rs1.refund_delete_flag = '0' "+
            "left join sale_policy sp on s.hospital_id = sp.sale_hospital_id and d.product_id = sp.sale_drug_id "+
            "where s.delete_flag='0' and s.group_id = '"+req.session.user[0].group_id+"' "+
            "and d.delete_flag='0' and d.group_id = '"+req.session.user[0].group_id+"' ";
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
      resolve({
        d:result,
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
  if(!util.isEmpty(req.body.data.product_distribution_flag)){
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
  sql = "select c.contacts_id,c.contacts_name,sum(sdc.refunds_should_money) rsm,c.contacts_phone from ("+sql+") sdc left join contacts c on c.contacts_id = sdc.contacts_id where c.delete_flag = '0' and c.group_id = '"+req.session.user[0].group_id+"' "+
        "group by c.contacts_id,c.contacts_name,c.contacts_phone having sum(sdc.refunds_should_money) > 0 order by sum(sdc.refunds_should_money) desc ";
  var sales = DB.get("Sales");
  sales.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "报表查询佣金欠款金额按人员，出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
//查询佣金外欠金额，按联系人
router.post("/getSalesReturnPayByContacts",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",99,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  //返款类型1：按销售返款 2：表示是采购（高打）返款 3：无返款
  var sql = "select s.*,sp.sale_policy_contact_id from sales s left join drugs d on s.product_code = d.product_code "+
            "left join sale_policy sp on s.hospital_id = sp.sale_hospital_id and d.product_id = sp.sale_drug_id "+//取上游是否返款
            "where s.delete_flag = '0' and s.group_id = '"+req.session.user[0].group_id+"' "+
            "and d.delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"' "+
            "and s.sale_return_time is null";
  sql = "select c.contacts_id,c.contacts_name,sum(sdc.sale_return_money) rsm,c.contacts_phone from ("+sql+") sdc left join contacts c on c.contacts_id = sdc.sale_policy_contact_id "+
        "where c.delete_flag = '0' and c.group_id = '"+req.session.user[0].group_id+"' "+
        "group by c.contacts_id,c.contacts_name,c.contacts_phone having sum(sdc.sale_return_money) > 0 order by sum(sdc.sale_return_money) desc ";
  var sales = DB.get("Sales");
  sales.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "报表查询佣金应付金额按联系人，出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
//查询调货应付金额，按调货联系人
router.post("/getAllotsReturnPayByContacts",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",99,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  //返款类型1：按销售返款 2：表示是采购（高打）返款 3：无返款
  var sql = "select a.*,ap.allot_policy_contact_id from allot a left join drugs d on a.allot_drug_id = d.product_id "+
            "left join allot_policy ap on a.allot_hospital = ap.allot_hospital_id and d.product_id = ap.allot_drug_id "+//取上游是否返款
            "where a.allot_delete_flag = '0' and a.allot_group_id = '"+req.session.user[0].group_id+"' "+
            "and d.delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"' "+
            "and a.allot_return_time is null";
  sql = "select c.contacts_id,c.contacts_name,sum(sdc.allot_return_money) rsm,c.contacts_phone from ("+sql+") sdc left join contacts c on c.contacts_id = sdc.allot_policy_contact_id "+
        "where c.delete_flag = '0' and c.group_id = '"+req.session.user[0].group_id+"' "+
        "group by c.contacts_id,c.contacts_name,c.contacts_phone having sum(sdc.allot_return_money) > 0 order by sum(sdc.allot_return_money) desc ";
  var allot = DB.get("Allot");
  allot.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "报表查询调货应付金额按联系人，出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
//招商预付外欠金额，按联系人
router.post("/getPurchasePaysReturnByContacts",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",99,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var sql = "select p.*,d.contacts_id from purchase_pay p left join drugs d on p.purchase_pay_drug_id = d.product_id "+
            "where p.purchase_pay_delete_flag = '0' and p.purchase_pay_group_id = '"+req.session.user[0].group_id+"' "+
            "and d.delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"' "+
            "and p.purchase_pay_real_time is null";
  sql = "select c.contacts_id,c.contacts_name,sum(sdc.purchase_pay_should_money) rsm,c.contacts_phone from ("+sql+") sdc left join contacts c on c.contacts_id = sdc.contacts_id "+
        "where c.delete_flag = '0' and c.group_id = '"+req.session.user[0].group_id+"' "+
        "group by c.contacts_id,c.contacts_name,c.contacts_phone having sum(sdc.purchase_pay_should_money) > 0 order by sum(sdc.purchase_pay_should_money) desc ";
  var allot = DB.get("Allot");
  allot.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "报表查询预付招商外欠金额按联系人，出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
//招商预付应付金额，按业务员
router.post("/getPurchasePayPaysReturnByContacts",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",99,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var sql = "select p.* from purchase_pay p left join d on p.purchase_pay_drug_id = d.product_id "+
            "where p.purchase_pay_delete_flag = '0' and p.purchase_pay_group_id = '"+req.session.user[0].group_id+"' "+
            "and d.delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"' "+
            "and p.purchase_pay_real_pay_time is null";
  sql = "select c.contacts_id,c.contacts_name,sum(sdc.purchase_pay_should_pay_money) rsm,c.contacts_phone from ("+sql+") sdc left join contacts c on c.contacts_id = sdc.purchase_pay_contact_id "+
        "where c.delete_flag = '0' and c.group_id = '"+req.session.user[0].group_id+"' "+
        "group by c.contacts_id,c.contacts_name,c.contacts_phone having sum(sdc.purchase_pay_should_pay_money) > 0 order by sum(sdc.purchase_pay_should_pay_money) desc ";
  var allot = DB.get("Allot");
  allot.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "报表查询预付招商应付金额按业务员，出错" + err);
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
  var prsql = "select * from purchase pr left join refunds r on pr.purchase_id = r.purchases_id where pr.purchase_return_flag='2' "+
              "and r.refunds_real_time is null && (r.refunds_real_money is null || r.refunds_real_money = '') "+
              "and pr.delete_flag = '0' and pr.group_id = '"+req.session.user[0].group_id+"'";
  if(req.body.makeMoneyFlag == "2"){
    prsql += "and pr.make_money_time is not null ";
  }
  //连接查询联系人、药品信息
  var sql = "select p.*,d.contacts_id from ("+prsql+") p left join drugs d on p.drug_id = d.product_id where d.delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"' ";
  sql = "select c.contacts_id,c.contacts_name,sum(pd.refunds_should_money) rsm,c.contacts_phone from ("+sql+") pd left join contacts c on c.contacts_id = pd.contacts_id where c.delete_flag = '0' and c.group_id = '"+req.session.user[0].group_id+"' "+
        "group by c.contacts_id,c.contacts_name,c.contacts_phone having sum(pd.refunds_should_money) > 0 order by sum(pd.refunds_should_money) desc ";

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
  if(!util.isEmpty(req.body.tag_type)){
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
