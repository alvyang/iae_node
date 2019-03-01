var express = require("express");
var pinyin = require("node-pinyin");
var logger = require('../utils/logger');
var nodeExcel = require('excel-export');
var util= require('../utils/global_util.js');
var router = express.Router();
//导出调货回款记录
router.post("/exportAllotRefund",function(req,res){
  if(req.session.user[0].authority_code.indexOf("137,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  req.body.data = req.body;
  var allot = DB.get("Allot");
  var sql = getAllotSql(req);
  sql += " order by a.allot_time desc,a.allot_create_time desc";
  allot.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "导出调货回款记录出错" + err);
    }
    for(var i = 0 ; i< result.length;i++){
      if(result[i].refunds_real_time && result[i].refunds_real_money){
         result[i].realMoney = util.div(result[i].refunds_real_money,result[i].purchase_number,2);
      }else{
         result[i].realMoney = 0;
      }
    }
    var conf ={};
    conf.stylesXmlFile = "./utils/styles.xml";
    conf.name = "mysheet";
    conf.cols = [{
        caption:'调货时间',
        type:'string',
        beforeCellWrite:function(row, cellData){
          return new Date(cellData).format('yyyy-MM-dd');
        }
    },{caption:'调货单位',type:'string'
    },{caption:'产品编码',type:'string'
    },{caption:'产品名称',type:'string'
    },{caption:'产品规格',type:'string'
    },{caption:'生产厂家',type:'string'
    },{caption:'单位',type:'string'
    },{caption:'商业',type:'string'
    },{caption:'调货数量',type:'number'
    },{caption:'中标价',type:'number'
    },{caption:'调货金额',type:'number'
    },{caption:'实收上游积分(单价)',type:'number'
    },{caption:'政策积分',type:'number'
    },{caption:'应付积分',type:'number'
    },{caption:'补点/费用票',type:'number',
      beforeCellWrite:function(row, cellData){
        if(cellData && cellData>0){
					var t = (cellData/row[18])*row[8];
					return Math.round(t*100)/100;
				}else{
					return 0;
				}
      }
    },{caption:'应付积分-补点/费用票',type:'number',
      beforeCellWrite:function(row, cellData){
        if(row[14] && row[14]>0){
          var t = (row[14]/row[18])*row[8];
          return cellData - Math.round(t*100)/100;
        }else{
          return cellData;
        }
      }
    },{
      caption:'回积分时间',
      type:'string',
      beforeCellWrite:function(row, cellData){
        if(cellData){
          return new Date(cellData).format('yyyy-MM-dd');
        }else{
          return "";
        }
      }
    },{caption:'回积分备注',type:'string'
    },{caption:'',type:'string',
      beforeCellWrite:function(row, cellData){
        return "";
    }}];
    var header = ['allot_time', 'hospital_name', 'product_code', 'product_common_name', 'product_specifications',
                  'product_makesmakers','product_unit','business_name','allot_number','allot_price','allot_money','realMoney',
                  'allot_return_price','allot_return_money','purchase_other_money','allot_return_money','allot_return_time',
                  'allot_policy_remark','purchase_number'];
    conf.rows = util.formatExcel(header,result);
    var result = nodeExcel.execute(conf);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats');
    res.setHeader("Content-Disposition", "attachment; filename=" + "Report.xlsx");
    res.end(result, 'binary');
  });
});
//获取调货列表
router.post("/getAllotReturnMoney",function(req,res){
  var noDate = new Date();
  if(req.session.user[0].authority_code.indexOf("61,") > 0  || req.session.user[0].authority_code.indexOf("126,") > 0){
    var allot = DB.get("Allot");
    var sql = getAllotSql(req);
    allot.countBySql(sql,function(err,result){//查询调货总数
      if(err){
        logger.error(req.session.user[0].realname + "查询调货列表，查询调货总数出错" + err);
      }
      var numSql = "select sum(num.allot_return_money) as returnMoney,sum(num.allot_real_return_money) as returnMoney1 from ( " + sql + " ) num";
      allot.executeSql(numSql,function(err,m){//查询调货应返金额
        if(err){
          logger.error(req.session.user[0].realname + "查询调货列表，计算返款金额出错" + err);
        }
        req.body.page.returnMoney = m && m[0].returnMoney?Math.round(m[0].returnMoney*100)/100:0;
        req.body.page.returnMoney1 = m && m[0].returnMoney1?Math.round(m[0].returnMoney1*100)/100:0;
        req.body.page.totalCount = result;
        req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
        sql += " order by a.allot_time desc,a.allot_create_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
        allot.executeSql(sql,function(err,result){
          if(err){
            logger.error(req.session.user[0].realname + "查询调货列表出错" + err);
          }
          req.body.page.data = result;
          logger.error(req.session.user[0].realname + "allot-getAllot运行时长" + (noDate.getTime()-new Date().getTime()));
          res.json({"code":"000000",message:req.body.page});
        });
      });

    });
  }else{
    res.json({"code":"111112",message:"无权限"});
  }

});
function getAllotSql(req){
  //连接查询调货记录和医院信息
  var sql = "select d.product_id,d.stock,d.product_code,d.product_common_name,d.product_specifications,d.product_makesmakers,d.product_unit,"+
            "d.product_price,d.product_mack_price,d.product_packing,d.product_return_money,"+
            "a.allot_account_name,a.allot_account_number,a.allot_account_address,a.allot_purchase_id,a.batch_number,"+
            "a.allot_id,a.allot_time,a.allot_number,a.allot_account_id,a.allot_return_flag,a.allot_hospital,"+
            "a.allot_return_price,a.allot_return_time,a.allot_mack_price,a.allot_price,a.allot_money,a.allot_return_money,"+
            "h.hospital_name,ap.allot_hospital_id,ap.allot_drug_id,ap.allot_policy_money,ap.allot_policy_remark,ap.allot_policy_contact_id,c.contacts_name,bus.business_name,"+
            "r.refunds_real_time,r.refunds_real_money,p.purchase_number,p.purchase_other_money,a.allot_real_return_money "+
            "from allot a "+
            "left join drugs d on a.allot_drug_id = d.product_id "+
            "left join allot_policy ap on a.allot_drug_id = ap.allot_drug_id and a.allot_hospital = ap.allot_hospital_id "+
            "left join purchase p on p.purchase_id = a.allot_purchase_id "+//取上游备货数量，计算实返金额
            "left join refunds r on r.purchases_id = a.allot_purchase_id  "+
            "left join contacts c on ap.allot_policy_contact_id = c.contacts_id "+
            "left join hospitals h on a.allot_hospital = h.hospital_id "+
            "left join business bus on d.product_business = bus.business_id "+
            "where a.allot_delete_flag = '0' and a.allot_group_id = '"+req.session.user[0].group_id+"' ";
  //数据权限
  if(req.session.user[0].data_authority == "2"){
    sql += "and a.allot_create_userid = '"+req.session.user[0].id+"'";
  }
  if(req.body.data.product_makesmakers){
    sql += "and d.product_makesmakers like '%"+req.body.data.product_makesmakers+"%'";
  }
  if(req.body.data.productCommonName){
    sql += " and (d.product_common_name like '%"+req.body.data.productCommonName+"%' or d.product_name_pinyin like '%"+req.body.data.productCommonName+"%')";
  }
  if(req.body.data.allot_hospital){
    sql += " and a.allot_hospital = '"+req.body.data.allot_hospital+"'"
  }
  if(req.body.data.product_code){
    sql += " and d.product_code = '"+req.body.data.product_code+"'"
  }
  if(req.body.data.business){
    sql += " and d.product_business = '"+req.body.data.business+"'"
  }
  if(req.body.data.allot_time){
    var start = new Date(req.body.data.allot_time[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.allot_time[1]).format("yyyy-MM-dd");
    sql += " and DATE_FORMAT(a.allot_time,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(a.allot_time,'%Y-%m-%d') <= '"+end+"'";
  }
  if(req.body.data.allotReturnTime){
    var start = new Date(req.body.data.allotReturnTime[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.allotReturnTime[1]).format("yyyy-MM-dd");
    sql += " and DATE_FORMAT(a.allot_return_time,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(a.allot_return_time,'%Y-%m-%d') <= '"+end+"'";
  }
  if(req.body.data.allot_return_flag){
    sql += req.body.data.allot_return_flag=="已付"?" and a.allot_return_time is not null":" and a.allot_return_time is null";
  }
  if(req.body.data.contactId){
    sql+=" and ap.allot_policy_contact_id = '"+req.body.data.contactId+"' ";
  }
  return sql;
}
//调货政策复制
router.post("/copyAllotPolicy",function(req,res){
  if(req.session.user[0].authority_code.indexOf("133,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var allotPolicy = DB.get("AllotPolicy");
  //查询所有选择的销售政策
  var sql = "select * from allot_policy ap where ap.allot_hospital_id = '"+req.body.hospital_id+"'";
  allotPolicy.executeSql(sql,function(err,d){
    if(err){
      logger.error(req.session.user[0].realname + "复制调货政策，查询已选择销售出错" + err);
    }
    var copySql = "insert into allot_policy(allot_hospital_id,allot_drug_id,allot_policy_money,allot_policy_remark,allot_policy_contact_id) values ";
    var allotHospital = "update allot set ";
    for(var i = 0 ; i < d.length ;i++){//查询已有医院政策
      copySql += "('"+req.body.hospital_id_copy+"','"+d[i].allot_drug_id+"','"+d[i].allot_policy_money+"','"+d[i].allot_policy_remark+"','"+d[i].allot_policy_contact_id+"'),";
    }
    copySql = copySql.substring(0,copySql.length-1);
    copySql += " ON DUPLICATE KEY UPDATE allot_policy_money=VALUES(allot_policy_money),allot_policy_remark=VALUES(allot_policy_remark),allot_policy_contact_id=VALUES(allot_policy_contact_id)";
    allotPolicy.executeSql(copySql,function(err,d){
      if(err){
        logger.error(req.session.user[0].realname + "复制调货政策，复制销售出错" + err);
      }
      res.json({"code":"000000",message:""});
    });

    var getAllotSql = "select * from allot a where a.allot_group_id = '"+req.session.user[0].group_id+"' "+
                      "and a.allot_delete_flag = '0' and (a.allot_account_id is null or a.allot_account_id = '') "+
                      "and a.allot_hospital = '"+req.body.hospital_id_copy+"'";
    allotPolicy.executeSql(getAllotSql,function(err,result){//查询所有，政策相关的调货记录，用于更新调货政策
      if(err){
        logger.error(req.session.user[0].realname + "更新政策前，查询要更新的记录更新出错" + err);
      }
      var allotHospital = "insert into allot (allot_id,allot_return_price,allot_return_money) values "
      var updateFlag = false;
      for(var m=0; m<d.length; m++){//这个循环，查询被复制医院的调货政策
        for(var j = 0 ; j < result.length ;j++){//这个循环，查询要更新-复制政策目标医院，的调货记录，根据记录id更新
          if(d[m].allot_drug_id == result[j].allot_drug_id){
            updateFlag=true;
            var t = util.mul(d[m].allot_policy_money,result[j].allot_number,2);
            allotHospital+="('"+result[j].allot_id+"','"+d[m].allot_policy_money+"','"+t+"'),";
          }
        }
      }
      if(updateFlag){//判断是否更新
        allotHospital = allotHospital.substring(0,allotHospital.length-1);
        allotHospital +=" on duplicate key update allot_return_price=values(allot_return_price),allot_return_money=values(allot_return_money)";
        allotPolicy.executeSql(allotHospital,function(err,result){//更新记录
          if(err){
            logger.error(req.session.user[0].realname + "更新政策后，将所有的调货记录更新出错" + err);
          }
        });
      }
    });
  });
});

//批量新增调货政策
router.post("/editAllotPolicyBatch",function(req,res){
  if(req.session.user[0].authority_code.indexOf("133,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var allotPolicy = DB.get("AllotPolicy");
  var sql = "insert into allot_policy(allot_hospital_id,allot_drug_id,allot_policy_money,allot_policy_remark,allot_policy_contact_id) values ";
  var drug = req.body.allotDrugs;
  for(var i = 0 ; i < drug.length ;i++){
    var p = req.body.type=="2"?drug[i].price:drug[i].returnMoney;
    p=p?p:0;
    var policyMoney = Math.round(p*req.body.policy_percent)/100;
    var hospitalId = drug[i].hospitalId?drug[i].hospitalId:req.body.allot_hospital_id;
    sql+="('"+hospitalId+"','"+drug[i].id+"','"+policyMoney+"','"+req.body.allot_policy_remark+"','"+req.body.allot_policy_contact_id+"'),";
  }
  sql = sql.substring(0,sql.length-1);
  sql +=" ON DUPLICATE KEY UPDATE allot_policy_money=VALUES(allot_policy_money),allot_policy_remark=VALUES(allot_policy_remark),allot_policy_contact_id=VALUES(allot_policy_contact_id)";
  allotPolicy.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "更新调货医院药品政策，出错" + err);
    }
    res.json({"code":"000000",message:""});
  });
  // var allotHospital = "update allot set allot_return_price = '"+req.body.allot_policy_money+"',allot_return_money=allot_number*"+req.body.allot_policy_money+" "+
  //                     "where allot_group_id = '"+req.session.user[0].group_id+"' and allot_hospital = '"+req.body.allot_hospital_id+"' "+
  //                     "and allot_drug_id = '"+req.body.allot_drug_id+"' and (allot_account_id is null or allot_account_id = '') ";
  // allotPolicy.executeSql(allotHospital,function(err,result){
  //   if(err){
  //     logger.error(req.session.user[0].realname + "更新政策后，将所有的调货记录更新出错" + err);
  //   }
  // });
});
//修改调货政策
router.post("/editAllotPolicy",function(req,res){
  if(req.session.user[0].authority_code.indexOf("133,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var allotPolicy = DB.get("AllotPolicy");
  var sql = "insert into allot_policy(allot_hospital_id,allot_drug_id,allot_policy_money,allot_policy_remark,allot_policy_contact_id";
      sql+=") values ('"+req.body.allot_hospital_id+"','"+req.body.allot_drug_id+"','"+req.body.allot_policy_money+"','"+req.body.allot_policy_remark+"','"+req.body.allot_policy_contact_id+"'";
      sql +=") ON DUPLICATE KEY UPDATE allot_policy_money=VALUES(allot_policy_money),allot_policy_remark=VALUES(allot_policy_remark),allot_policy_contact_id=VALUES(allot_policy_contact_id)";
  allotPolicy.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "更新调货医院药品政策，出错" + err);
    }
    res.json({"code":"000000",message:""});
  });
  // var allotHospital = "update allot set allot_return_price = '"+req.body.allot_policy_money+"',allot_return_money=allot_number*"+req.body.allot_policy_money+" "+
  //                     "where allot_group_id = '"+req.session.user[0].group_id+"' and allot_hospital = '"+req.body.allot_hospital_id+"' "+
  //                     "and allot_drug_id = '"+req.body.allot_drug_id+"' and (allot_account_id is null or allot_account_id = '') ";
  // allotPolicy.executeSql(allotHospital,function(err,result){
  //   if(err){
  //     logger.error(req.session.user[0].realname + "更新政策后，将所有的调货记录更新出错" + err);
  //   }
  // });
});
//导出销售政策
router.post("/exportAllotPolicy",function(req,res){
  if(req.session.user[0].authority_code.indexOf("135,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  req.body.data = req.body;
  var salePolicy = DB.get("SalePolicy");
  var sql = getAllotPolicySql(req);
  sql += " order by dsp.product_create_time asc";
  salePolicy.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "导出调货政策出错" + err);
    }
    var conf ={};
    conf.stylesXmlFile = "./utils/styles.xml";
    conf.name = "mysheet";
    conf.cols = [{caption:'产品编码',type:'string'
    },{caption:'产品名称',type:'string'
    },{caption:'产品规格',type:'string'
    },{caption:'生产厂家',type:'string'
    },{caption:'单位',type:'string'
    },{caption:'商业',type:'string'
    },{caption:'中标价',type:'number'
    },{caption:'积分',type:'string'
    },{caption:'调货积分',type:'string'
    },{caption:'积分备注',type:'string'
    },{caption:'业务员',type:'string'
    }];
    var header = ['product_code', 'product_common_name', 'product_specifications',
                  'product_makesmakers','product_unit','business_name','product_price','product_return_money','allot_policy_money',
                  'allot_policy_remark','contacts_name'];
    conf.rows = util.formatExcel(header,result);
    var result = nodeExcel.execute(conf);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats');
    res.setHeader("Content-Disposition", "attachment; filename=" + "Report.xlsx");
    res.end(result, 'binary');
  });
});
//查询销售政策
router.post("/getAllotPolicy",function(req,res){
  if(req.session.user[0].authority_code.indexOf("132,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var sql = getAllotPolicySql(req);
  var salePolicy = DB.get("SalePolicy");
  salePolicy.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询调货医院药品政策分页列表，统计总数出错" + err);
    }
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql += " order by dsp.product_create_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
    salePolicy.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "查询调货医院药品政策分页列表，出错" + err);
      }
      req.body.page.data = result;
      res.json({"code":"000000",message:req.body.page});
    });
  });
});
function getAllotPolicySql(req){
  //药品连接政策
  var sql = "select * from allot_policy ap left join drugs d on d.product_id = ap.allot_drug_id "+
            " where d.delete_flag='0' and d.group_id = '"+req.session.user[0].group_id+"' "+
            " and d.product_type in ('高打') and ap.allot_policy_money != '' and ap.allot_policy_money is not null ";
  if(req.body.data.hospitalId){
    sql += " and ap.allot_hospital_id = '"+req.body.data.hospitalId+"' ";
  }
  if(req.body.data.productCommonName){
    sql += " and (d.product_common_name like '%"+req.body.data.productCommonName+"%' or d.product_name_pinyin like '%"+req.body.data.productCommonName+"%')";
  }
  if(req.body.data.contactId){
    sql += " and ap.allot_policy_contact_id = '"+req.body.data.contactId+"'";
  }
  if(req.body.data.productCode){
    sql += " and d.product_code = '"+req.body.data.productCode+"'";
  }
  //连接业务员
  sql = "select apc.*,c.contacts_name from ("+sql+") apc left join contacts c on apc.allot_policy_contact_id = c.contacts_id";
  //连接销往单位
  sql = "select dsch.*,h.hospital_name from ("+sql+") dsch left join hospitals h on dsch.allot_hospital_id = h.hospital_id ";
  //连接商业
  sql = "select * from ("+sql+") dsp left join business b on dsp.product_business = b.business_id";
  return sql;
}

//查询调货未添加政策的药品
router.post("/getAllotPolicyDrugs",function(req,res){
  if(req.session.user[0].authority_code.indexOf("132,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var sql = getAllotPolicySqlDrugs(req);
  var salePolicy = DB.get("SalePolicy");
  salePolicy.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询调货医院药品政策（未添加的药品）分页列表，统计总数出错" + err);
    }
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql += " order by dsp.product_create_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
    salePolicy.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "查询调货医院药品政策（未添加的药品）分页列表，出错" + err);
      }
      req.body.page.data = result;
      res.json({"code":"000000",message:req.body.page});
    });
  });
});
//获取还未添加政策的药品
function getAllotPolicySqlDrugs(req){
  //药品连接政策
  var sql = "select * from drugs d left join allot_policy ap on d.product_id = ap.allot_drug_id "+
            " and (ap.allot_hospital_id = '"+req.body.data.hospitalId+"' or ap.allot_hospital_id is null) "+
            " where d.delete_flag='0' and d.group_id = '"+req.session.user[0].group_id+"' "+
            " and d.product_type in ('高打') and (ap.allot_policy_money is null or ap.allot_policy_money ='') ";
  if(req.body.data.productCommonName){
    sql += " and (d.product_common_name like '%"+req.body.data.productCommonName+"%' or d.product_name_pinyin like '%"+req.body.data.productCommonName+"%')";
  }
  if(req.body.data.productCode){
    sql += " and d.product_code = '"+req.body.data.productCode+"'";
  }
  //连接业务员
  sql = "select apc.*,c.contacts_name from ("+sql+") apc left join contacts c on apc.allot_policy_contact_id = c.contacts_id";
  //连接销往单位
  sql = "select dsch.*,h.hospital_name from ("+sql+") dsch left join hospitals h on dsch.allot_hospital_id = h.hospital_id ";
  //连接商业
  sql = "select * from ("+sql+") dsp left join business b on dsp.product_business = b.business_id";
  return sql;
}
module.exports = router;
