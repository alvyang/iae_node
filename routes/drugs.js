var express = require("express");
var pinyin = require("node-pinyin");
var logger = require('../utils/logger');
var nodeExcel = require('excel-export');
var util= require('../utils/global_util.js');
var parse = require('csv-parse');
var XLSX = require("xlsx");
var uuid=require("node-uuid");
var router = express.Router();
String.prototype.trim=function(){
　　return this.replace(/(^\s*)|(\s*$)/g, "");
}
router.get("/downloadErrorData",function(req,res){
  var conf ={};
  conf.stylesXmlFile = "./utils/styles.xml";
  conf.name = "mysheet";
  conf.cols = [{caption:'产品名称',type:'string'
  },{caption:'产品编号',type:'string'
  },{caption:'产品规格',type:'string'
  },{caption:'生产企业',type:'string'
  },{caption:'产品税率',type:'string'
  },{caption:'采购员',type:'string'
  },{caption:'商业',type:'string'
  },{caption:'包装',type:'number'
  },{caption:'单位（支/盒/瓶/袋）',type:'string'
  },{caption:'医保类型（甲类/乙类/丙类/省医保）',type:'string'
  },{caption:'中标价',type:'number'
  },{caption:'成本价',type:'number'
  },{caption:'核算成本价',type:'number'
  },{caption:'采购方式（招标/议价）',type:'string'
  },{caption:'是否基药（基药/非基药）',type:'string'
  },{caption:'品种类型（高打/佣金/其它）',type:'string'
  },{caption:'底价',type:'number'
  },{caption:'高开返款率',type:'number'
  },{caption:'返款金额',type:'number'
  },{caption:'返款说明',type:'string'
  },{caption:'返款统计（1:销售记录返。2:备货记录返；3:无返款）',type:'string'
  },{caption:'联系人',type:'string'
  },{caption:'错误信息',type:'string'
  }];
  var header = ['product_common_name','product_code','product_specifications','product_makesmakers','product_tax_rate',
            'buyer','product_business','product_packing','product_unit','product_medical_type','product_price','product_mack_price',
            'accounting_cost','product_purchase_mode','product_basic_medicine','product_type','product_floor_price','product_high_discount',
            'product_return_money','product_return_explain','product_return_statistics','contacts_name','errorMessage'];
  var d = JSON.parse(req.session.errorDrugsData);

  conf.rows = util.formatExcel(header,d);
  var result = nodeExcel.execute(conf);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats');
  res.setHeader("Content-Disposition", "attachment; filename=" + "error.xlsx");
  res.end(result, 'binary');
});
//excel 导入药品数据
router.post("/importDrugs",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",100,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  if(!(req.files.file.path.split(".")[1] == "xls" || req.files.file.path.split(".")[1] == "xlsx")){
    res.json({"code":"111112",message:"<a style='color:red;'>文件格式错误</a>"});
    return ;
  }
  var workbook = XLSX.readFile(req.files.file.path);
  workbook.SheetNames.forEach(function (sheetName) {//excel工作表
    var csvdatas = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);//获取单元格
    parse(csvdatas, function (err, output) {//解释成行数据
      if (err){
        return;
      }
      getDrugsInsertData(req).then(data => {
        var drugData = getDrugsData(output,data.code,data.business,data.contact);//转换数据
        req.session.errorDrugsData = null;
        req.session.errorDrugsData = JSON.stringify(drugData.errData);//错误的数据
        var cData = drugData.correctData;//正确的数据
        var importMessage = "数据导入成功<a style='color:red;'>"+cData.length+"</a>条；导入错误<a style='color:red;'>"+drugData.errData.length+"</a>条；"
        if(cData.length<1){
          var message = req.session.user[0].realname+"导入药品记录，数据导入错误"+drugData.errData.length+"条；";
          util.saveLogs(req.session.user[0].group_id,"-","-",message);
          res.json({"code":"000000",message:importMessage});
          return;
        }
        var sql = "insert into drugs(product_id,product_common_name,product_code,product_specifications,product_makesmakers,product_supplier,product_tax_rate,"+
                  "buyer,product_business,product_packing,product_unit,product_basic_medicine,product_price,product_mack_price,"+
                  "accounting_cost,product_purchase_mode,product_type,product_floor_price,product_high_discount,"+
                  "product_return_money,product_return_explain,product_return_statistics,group_id,product_create_time,product_create_userid,"+
                  "product_discount,gross_interest_rate,product_medical_type,product_return_discount,contacts_id,product_name_pinyin) VALUES ";
        for(var i = 0 ; i < cData.length; i++){
          cData[i].product_id = uuid.v1();
          cData[i].group_id = req.session.user[0].group_id;
          var createTime = new Date();
          createTime.setTime(createTime.getTime()+i*1000);
          cData[i].product_create_time = createTime.format('yyyy-MM-dd hh:mm:ss');

          cData[i].product_create_userid = req.session.user[0].id;
          cData[i].product_return_discount = cData[i].product_return_money&&cData[i].product_price?util.div(cData[i].product_return_money,cData[i].product_price,4)*100:"";
          sql += "('"+cData[i].product_id+"','"+cData[i].product_common_name+"','"+cData[i].product_code+"','"+cData[i].product_specifications+"',"+
                 "'"+cData[i].product_makesmakers+"','"+cData[i].product_supplier+"','"+cData[i].product_tax_rate+"','"+cData[i].buyer+"',"+
                 "'"+cData[i].product_business+"','"+cData[i].product_packing+"','"+cData[i].product_unit+"','"+cData[i].product_basic_medicine+"',"+
                 "'"+cData[i].product_price+"','"+cData[i].product_mack_price+"','"+cData[i].accounting_cost+"','"+cData[i].product_purchase_mode+"',"+
                 "'"+cData[i].product_type+"','"+cData[i].product_floor_price+"','"+cData[i].product_high_discount+"',"+
                 "'"+cData[i].product_return_money+"','"+cData[i].product_return_explain+"','"+cData[i].product_return_statistics+"',"+
                 "'"+cData[i].group_id+"','"+cData[i].product_create_time+"','"+cData[i].product_create_userid+"','"+cData[i].product_discount+"',"+
                 "'"+cData[i].gross_interest_rate+"','"+cData[i].product_medical_type+"','"+cData[i].product_return_discount+"','"+cData[i].contacts_id+"','"+cData[i].product_name_pinyin+"'),";
        }
        sql = sql.substring(0,sql.length-1);
        var drugsSql = DB.get("Drugs");
        drugsSql.executeSql(sql,function(err,result){
          if(err){
            logger.error(req.session.user[0].realname + "批量添加药品出错" + err);
          }else{
            //导入成功后，自动添加下游政策
            updateBatchHospitalsPolicy(req,cData);
          }
          var message = req.session.user[0].realname+"导入药品记录，数据导入成功"+cData.length+"条；导入错误"+drugData.errData.length+"条；";
          util.saveLogs(req.session.user[0].group_id,"-","-",message);
          res.json({"code":"000000",message:importMessage});
        });
      });
    });
  });
});
//promise  获取所有产品编码和商业
function getDrugsInsertData(req){
  var drugsSql = DB.get("Drugs");
  return new Promise((resolve, reject) => {//查询所有药品编码
    var drugCodeSql = "select d.product_code from drugs d where d.group_id='"+req.session.user[0].group_id+"' and d.delete_flag='0' ";
    drugsSql.executeSql(drugCodeSql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "查询所有药品编码出错" + err);
        reject(err);
      }else{
        resolve(result);
      }
    });
  }).then(code => {//查询所有的商业
    var business = DB.get("Business");
    req.body.business_group_id = req.session.user[0].group_id;
    req.body.business_delete_flag = 0;
    return new Promise((resolve, reject) => {//查询所有药品编码
      business.where(req.body,function(err,result){
        if(err){
          logger.error(req.session.user[0].realname + "查询商业，查询所有商业出错" + err);
          reject(err);
        }else{
          resolve({code:code,business:result});
        }
      });
    });
  }).then(data => {//查询所有的联系人
    var contacts = DB.get("Contacts");
    var sql = "select * from contacts c where c.delete_flag = '0' and c.group_id = '"+req.session.user[0].group_id+"' ";
    return new Promise((resolve, reject) => {//查询所有药品编码
      contacts.executeSql(sql,function(err,contacts){
        if(err){
          logger.error(req.session.user[0].realname + "导入药品，查询所有联系人出错" + err);
        }
        data.contact = contacts;
        resolve(data);
      });
    });
  });
}
//对上传的excel进行检验，选择出所有正确的数据和错误的数据
function getDrugsData(drugs,code,business,contacts){
  //去空格处理
  for(var i = 0 ; i < drugs.length;i++){
    for(var j = 0 ;j<drugs[i].length ;j++){
      drugs[i][j] = drugs[i][j].trim();
    }
  }
  var correctData=[];
  var errData=[];
  for(var i = 1 ;i < drugs.length;i++){
      var d = arrayToObject(drugs[i]);
      //非空验证
      if(util.isEmpty(drugs[i][0]) || util.isEmpty(drugs[i][1]) || util.isEmpty(drugs[i][2]) || util.isEmpty(drugs[i][3])
        || util.isEmpty(drugs[i][15]) || util.isEmpty(drugs[i][20])){
        d.errorMessage = "产品名称、产品编码、产品规格、生产企业、品种类型、返款统计为必填项";
        errData.push(d);
        continue;
      }
      //验证编码是否存在，  1位置在模板中为产品编码drugs[i][1]
      if(JSON.stringify(code).indexOf("\""+drugs[i][1]+"\"") > 0){
        d.errorMessage = "产品编码已存在";
        errData.push(d);
        continue;
      }
      //验证价格是否为正确的数字
      var moneyReg = /^(([1-9]\d+(.[0-9]{1,})?|\d(.[0-9]{1,})?)|([-]([1-9]\d+(.[0-9]{1,})?|\d(.[0-9]{1,})?)))$/;
      if( (drugs[i][4] && !moneyReg.test(drugs[i][4])) ||
          (drugs[i][10] && !moneyReg.test(drugs[i][10])) ||
          (drugs[i][11] && !moneyReg.test(drugs[i][11])) ||
          (drugs[i][12] && !moneyReg.test(drugs[i][12])) ||
          (drugs[i][16] && !moneyReg.test(drugs[i][16])) ||
          (drugs[i][17] && !moneyReg.test(drugs[i][17])) ||
          (drugs[i][18] && !moneyReg.test(drugs[i][18]))){
        d.errorMessage = "产品税率、中标价、成本价、核算成本价、底价、高开返款率、返款金额填写错误";
        errData.push(d);
        continue;
      }
      //返款统计为1 2 3
      if(!util.isEmpty(drugs[i][20]) && !(drugs[i][20]=='1'||drugs[i][20]=='2'||drugs[i][20]=='3')){
        d.errorMessage = "返款统计填写1/2/3（1表示销售记录返。2表示按备货记录返；3表示无返款）";
        errData.push(d);
        continue;
      }
      //采购方式   招标/议价
      if(!util.isEmpty(drugs[i][13]) && !(drugs[i][13]=='议价'||drugs[i][13]=='招标')){
        d.errorMessage = "采购方式填写 议价/招标";
        errData.push(d);
        continue;
      }
      //是否基药   基药/非基药
      if(!util.isEmpty(drugs[i][14]) && !(drugs[i][14]=='基药'||drugs[i][14]=='非基药')){
        d.errorMessage = "是否基药请填写 基药/非基药";
        errData.push(d);
        continue;
      }
      //品种类型 高打/佣金/其它
      if(!util.isEmpty(drugs[i][15]) && !(drugs[i][15]=='高打'||drugs[i][15]=='佣金'||drugs[i][15]=='其它')){
        d.errorMessage = "品种类型请填写 高打/佣金/其它";
        errData.push(d);
        continue;
      }
      //单位（支/盒/瓶/袋）
      if(!util.isEmpty(drugs[i][8]) && !(drugs[i][8]=='支'||drugs[i][8]=='盒'||drugs[i][8]=='瓶'||drugs[i][8]=='袋')){
        d.errorMessage = "单位请填写 支/盒/瓶/袋";
        errData.push(d);
        continue;
      }
      //医保类型（甲类/乙类/丙类/省医保）
      if(!util.isEmpty(drugs[i][9]) && !(drugs[i][9]=='甲类'||drugs[i][9]=='乙类'||drugs[i][9]=='丙类'||drugs[i][9]=='省医保')){
        d.errorMessage = "医保类型请填写 甲类/乙类/丙类/省医保";
        errData.push(d);
        continue;
      }
      //商业
      d.product_business = getBusinessId(business,drugs[i][6]);
      d.contacts_id = getContactsId(contacts,drugs[i][21]);
      if(util.isEmpty(d.product_business)){
        d.errorMessage = "该商业不存在";
        errData.push(d);
        continue;
      }
      //生成助记码
      d.product_name_pinyin = util.getFirstLetter(drugs[i][0]);
      //计算扣率和毛利率
      d.product_discount =  drugs[i][11]&&drugs[i][10]?util.div(drugs[i][11],drugs[i][10],4)*100:"";
      d.gross_interest_rate = drugs[i][12]&&drugs[i][10]?util.sub(100,util.div(drugs[i][12],drugs[i][10],4)*100,4):"";

      //将生产企业，修改为供货单位
      d.product_supplier = d.product_makesmakers;
      //计算返款金额 返款率
      if(!util.isEmpty(drugs[i][11]) && !util.isEmpty(drugs[i][16]) && !util.isEmpty(drugs[i][17])){
        var t1 = util.sub(drugs[i][11],drugs[i][16]);
        var t2 = util.sub(1,drugs[i][17]/100);
        d.product_return_money = util.mul(t1,t2,2);//返款金额
      }
      d.product_return_discount = drugs[i][18]&&drugs[i][10]?util.div(drugs[i][18],drugs[i][10],2):"";//返款率
      correctData.push(d);
  }
  return {
    correctData:correctData,
    errData:errData
  };
}
//根据联系人名称 查询id
function getContactsId(contacts,name){
  for(var i = 0 ; i < contacts.length ;i++){
    if(contacts[i].contacts_name == name){
      return contacts[i].contacts_id;
    }
  }
  return "";
}
//数据根据值，取出数据中的对象
function getBusinessId(business,name){
  for(var i = 0 ; i < business.length ;i++){
    if(business[i].business_name == name){
      return business[i].business_id;
    }
  }
  return "";
}
//将数组转成对象
function arrayToObject(drugs){
  return {
    product_common_name:drugs[0],
    product_code:drugs[1],
    product_specifications:drugs[2],
    product_makesmakers:drugs[3],
    product_tax_rate:drugs[4],
    buyer:drugs[5],
    product_business:drugs[6],
    product_packing:drugs[7],
    product_unit:drugs[8],
    product_medical_type:drugs[9],
    product_price:drugs[10],
    product_mack_price:drugs[11],
    accounting_cost:drugs[12],
    product_purchase_mode:drugs[13],
    product_basic_medicine:drugs[14],
    product_type:drugs[15],
    product_floor_price:drugs[16],
    product_high_discount:drugs[17],
    product_return_money:drugs[18],
    product_return_explain:drugs[19],
    product_return_statistics:drugs[20],
    contacts_name:drugs[21]
  }
}
//验证产品编码是否存在
router.post("/getFirstLetter",function(req,res){
  res.json({"code":"000000",message:util.getFirstLetter(req.body.name)});
});
//验证产品编码是否存在
router.post("/exitsCode",function(req,res){
  var drugs = DB.get("Drugs");
  req.body.group_id = req.session.user[0].group_id;
  req.body.delete_flag = '0';
  drugs.where(req.body,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "验证药品编码是否出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
function deleteParams(params){
  for (var pro in params) {
    if(util.isEmpty(params[pro])){
      delete params[pro];
    }
  }
}
//新增药品
router.post("/saveDrugs",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",62,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var drugs = DB.get("Drugs");
  req.body.group_id = req.session.user[0].group_id;
  delete req.body.product_id;
  delete req.body.readonly;
  //判断tag_ids和tag_ids_temp  取出新增和删除的标签id。用于修改引用次数
  var tagIds = req.body.tag_ids.split(",");
  var tagIdsTemp = req.body.tag_ids_temp.split(",");
  delete req.body.tag_ids_temp;
  delete req.body.tag_ids;
  deleteParams(req.body);
  req.body.product_create_time = new Date();
  req.body.product_create_userid = req.session.user[0].id;
  drugs.insert(req.body,'product_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "新增药品出错" + err);
    }else{
      updateQuoteNum(tagIds,tagIdsTemp,req,result);
      //根据设置的政策，更新下游政策
      updateHospitalSale(req,result);
    }
    var message = req.session.user[0].realname+"新增药品记录。id："+req.body.product_id;
    util.saveLogs(req.session.user[0].group_id,"-",JSON.stringify(req.body),message);
    res.json({"code":"000000",message:result});
  });
});
function updateBatchHospitalsPolicy(req,drugs){
  var sql = "select hsp.*,h.hospital_type from hospital_sale_policy hsp left join hospitals h on hsp.hospital_sale_policy_hospital_id = h.hospital_id "+
            "where hsp.hospital_sale_policy_group_id = '"+req.session.user[0].group_id+"' "+
            "and (hsp.hospital_sale_policy is not null or hsp.hospital_sale_policy != '' ) "+
            "or (hsp.hospital_sale_contacts_id is not null or hsp.hospital_sale_contacts_id != '')";
  var hospitalSalePolicy = DB.get("HospitalSalePolicy");
  hospitalSalePolicy.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "导入添加药品，自动添加政策，查询销往单位政策出错" + err);
    }
    updateBatchDurgSalePolicy(req,drugs,result);
  });
}
function updateBatchDurgSalePolicy(req,drugs,result){
  var sql = "insert into sale_policy(sale_hospital_id,sale_drug_id,sale_policy_money,sale_policy_contact_id,sale_policy_formula,sale_policy_percent,sale_policy_remark) values ";
  var sql2 = "insert into allot_policy(allot_hospital_id,allot_drug_id,allot_policy_money,allot_policy_contact_id,allot_policy_formula,allot_policy_percent,allot_policy_remark) values ";
  var sqlFlag = false,sql2Flag = false;
  for(var j = 0;j<drugs.length;j++){
    for(var i = 0 ; i < result.length; i++){
      var policyMoney =  util.getShouldPayMoney(result[i].hospital_sale_policy,drugs[j].product_price,drugs[j].product_return_money,result[i].policy_percent,0,0);
      if(result[i].hospital_type.indexOf("销售单位") > -1 && drugs[j].product_type != '其它'){
        sqlFlag = true;
        sql+="('"+result[i].hospital_sale_policy_hospital_id+"','"+drugs[j].product_id+"','"+policyMoney+"','"+result[i].hospital_sale_contacts_id+"','"+result[i].hospital_sale_policy+"','"+result[i].policy_percent+"','"+result[i].hospital_sale_policy_remark+"'),";
      }else if(result[i].hospital_type.indexOf("调货单位") > -1 && drugs[j].product_type =='高打'){
        sql2Flag = true;
        sql2+="('"+result[i].hospital_sale_policy_hospital_id+"','"+drugs[j].product_id+"','"+policyMoney+"','"+result[i].hospital_sale_contacts_id+"','"+result[i].hospital_sale_policy+"','"+result[i].policy_percent+"','"+result[i].hospital_sale_policy_remark+"'),";
      }
    };
  }
  sql = sql.substring(0,sql.length-1);
  sql +=" ON DUPLICATE KEY UPDATE sale_policy_money=VALUES(sale_policy_money),sale_policy_contact_id=VALUES(sale_policy_contact_id),sale_policy_formula=VALUES(sale_policy_formula),sale_policy_percent=VALUES(sale_policy_percent),sale_policy_remark=VALUES(sale_policy_remark)";
  sql2 = sql2.substring(0,sql2.length-1);
  sql2 +=" ON DUPLICATE KEY UPDATE allot_policy_money=VALUES(allot_policy_money),allot_policy_contact_id=VALUES(allot_policy_contact_id),allot_policy_formula=VALUES(allot_policy_formula),allot_policy_percent=VALUES(allot_policy_percent),allot_policy_remark=VALUES(allot_policy_remark)";
  var salePolicy = DB.get("SalePolicy");
  var allotPolicy = DB.get("AllotPolicy");
  if(sqlFlag){
    salePolicy.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "新增药品，添加销售政策出错" + err);
      }
    });
  }
  if(sql2Flag){
    allotPolicy.executeSql(sql2,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "新增药品，添加调货政策出错" + err);
      }
    });
  }
}
//添加药品后，根据医院政策自动添加下游政策
function updateHospitalSale(req,drugId){
  var sql = "select hsp.*,h.hospital_type from hospital_sale_policy hsp left join hospitals h on hsp.hospital_sale_policy_hospital_id = h.hospital_id "+
            "where hsp.hospital_sale_policy_group_id = '"+req.session.user[0].group_id+"' "+
            "and (hsp.hospital_sale_policy is not null or hsp.hospital_sale_policy != '' ) "+
            "or (hsp.hospital_sale_contacts_id is not null or hsp.hospital_sale_contacts_id != '')";
  var hospitalSalePolicy = DB.get("HospitalSalePolicy");
  hospitalSalePolicy.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "添加药品，自动添加政策，查询销往单位政策出错" + err);
    }
    updateDurgSalePolicy(req,result,drugId);
  });
}
//更新政策
function updateDurgSalePolicy(req,result,drugId){
  var sql = "insert into sale_policy(sale_hospital_id,sale_drug_id,sale_policy_money,sale_policy_contact_id,sale_policy_formula,sale_policy_percent,sale_policy_remark) values ";
  var sql2 = "insert into allot_policy(allot_hospital_id,allot_drug_id,allot_policy_money,allot_policy_contact_id,allot_policy_formula,allot_policy_percent,allot_policy_remark) values ";
  var sqlFlag = false,sql2Flag = false;
  for(var i = 0 ; i < result.length; i++){
    var policyMoney =  util.getShouldPayMoney(result[i].hospital_sale_policy,req.body.product_price,req.body.product_return_money,result[i].policy_percent,0,0);
    if(result[i].hospital_type.indexOf("销售单位") > -1 && req.body.product_type != '其它'){
      sqlFlag = true;
      sql+="('"+result[i].hospital_sale_policy_hospital_id+"','"+drugId+"','"+policyMoney+"','"+result[i].hospital_sale_contacts_id+"','"+result[i].hospital_sale_policy+"','"+result[i].policy_percent+"','"+result[i].hospital_sale_policy_remark+"'),";
    }else if(result[i].hospital_type.indexOf("调货单位") > -1 && req.body.product_type =='高打'){
      sql2Flag = true;
      sql2+="('"+result[i].hospital_sale_policy_hospital_id+"','"+drugId+"','"+policyMoney+"','"+result[i].hospital_sale_contacts_id+"','"+result[i].hospital_sale_policy+"','"+result[i].policy_percent+"','"+result[i].hospital_sale_policy_remark+"'),";
    }
  };
  sql = sql.substring(0,sql.length-1);
  sql +=" ON DUPLICATE KEY UPDATE sale_policy_money=VALUES(sale_policy_money),sale_policy_contact_id=VALUES(sale_policy_contact_id),sale_policy_formula=VALUES(sale_policy_formula),sale_policy_percent=VALUES(sale_policy_percent),sale_policy_remark=VALUES(sale_policy_remark)";
  sql2 = sql2.substring(0,sql2.length-1);
  sql2 +=" ON DUPLICATE KEY UPDATE allot_policy_money=VALUES(allot_policy_money),allot_policy_contact_id=VALUES(allot_policy_contact_id),allot_policy_formula=VALUES(allot_policy_formula),allot_policy_percent=VALUES(allot_policy_percent),allot_policy_remark=VALUES(allot_policy_remark)";
  var salePolicy = DB.get("SalePolicy");
  var allotPolicy = DB.get("AllotPolicy");
  if(sqlFlag){
    salePolicy.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "新增药品，添加销售政策出错" + err);
      }
    });
  }
  if(sql2Flag){
    allotPolicy.executeSql(sql2,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "新增药品，添加调货政策出错" + err);
      }
    });
  }
}

//修改标签引用交数
function updateQuoteNum(data1,data2,req,drugId){
  var addTags = util.getArrayDuplicateRemoval(data1,data2);
  var deleteTags = util.getArrayDuplicateRemoval(data2,data1).join(",");
  deleteTags.replace(",","','");
  if(!util.isEmpty(deleteTags)){
    var deleteSql = "update tag_drug set tag_drug_deleta_flag='1' where drug_id = '"+drugId+"' and tag_id in ('"+deleteTags+"')";
    var tag = DB.get("Tag");
    tag.executeSql(deleteSql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "药品删除标签出错" + err);
      }
    });
  }
  for(var i = 0 ; i < addTags.length ;i++){
    var p = {
      drug_id:drugId,
      tag_id:addTags[i],
      tag_drug_group_id:req.session.user[0].group_id
    }
    var tagDrug = DB.get("TagDrug");
    tagDrug.insert(p,'tag_drug_id',function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "药品添加标签出错" + err);
      }
    });
  }
}
//标记为是否配送
router.post("/distributionFlag",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",63,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var drugs = DB.get("Drugs");
  drugs.update(req.body,'product_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "标记药品是否配送出错" + err);
    }
    var message = req.session.user[0].realname+"药品配送/不配送。id："+req.body.product_id;
    util.saveLogs(req.session.user[0].group_id,"-",JSON.stringify(req.body),message);
    res.json({"code":"000000",message:null});
  });
});
//编辑药品
router.post("/editDrugs",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",63,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  delete req.body.contacts_name;
  if(util.isEmpty(req.body.contacts_id)){
    delete req.body.contacts_id;
  }
  var flag = req.body.product_return_statistics_update;
  delete req.body.product_return_statistics_update;
  delete req.body.readonly;
  //判断tag_ids和tag_ids_temp  取出新增和删除的标签id。用于修改引用次数
  var tagIds = req.body.tag_ids.split(",");
  var tagIdsTemp = req.body.tag_ids_temp.split(",");
  delete req.body.tag_ids_temp;
  delete req.body.tag_ids;
  delete req.body.product_create_time;
  var drugs = DB.get("Drugs");
  var front_message = req.body.front_message;
  drugs.update(req.body,'product_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "修改药品出错" + err);

    }else{
      updateQuoteNum(tagIds,tagIdsTemp,req,req.body.product_id);
    }
    var message = req.session.user[0].realname+"修改药品记录。id："+req.body.product_id;
    util.saveLogs(req.session.user[0].group_id,front_message,JSON.stringify(req.body),message);
    res.json({"code":"000000",message:null});
  });
  //修改药品信息后，更新政策
  updateSalePolicy(req);
  updateAllotPolicy(req);
  if(flag == "true"){
    var sales = DB.get("Sales");
    var sql = "update sales set sale_return_flag = '"+req.body.product_return_statistics+"' where product_code = '"+req.body.product_code+"'";
    sales.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "修改药品返款统计时，更新销售单出错" + err);
      }
    });
  }
  //如果添加了政策，更新应收
  if(!util.isEmpty(req.body.product_return_money)){

    //更新销售
    var salesSql = "update refunds r left join sales s on r.sales_id = s.sale_id set r.refunds_policy_money='"+req.body.product_return_money+"',r.refunds_should_money = ROUND(s.sale_num*"+req.body.product_return_money+",2) "+
                    "where (r.refunds_policy_money is null or r.refunds_policy_money = '0' or r.refunds_policy_money = '') and (r.refunds_should_money is null or r.refunds_should_money = '0' or r.refunds_should_money = '') "+
                    "and s.group_id = '"+req.session.user[0].group_id+"' and s.delete_flag = '0' "+
                    "and s.product_code = '"+req.body.product_code+"' ";
    var sales = DB.get("Sales");
    sales.executeSql(salesSql,function(err,d){
      if(err){
        logger.error(req.session.user[0].realname + "修改药品，更新销售应收出错" + err);
      }
    });
    //更新采进
    var purchaseSql = "update refunds r left join purchase p on r.purchases_id = p.purchase_id set "+
                    "r.refunds_policy_money='"+req.body.product_return_money+"',r.refunds_should_money = ROUND(p.purchase_number*"+req.body.product_return_money+",2) "+
                    "where (r.refunds_policy_money is null or r.refunds_policy_money = '0' or r.refunds_policy_money = '') and (r.refunds_should_money is null or r.refunds_should_money = '0' or r.refunds_should_money = '') "+
                    "and p.group_id = '"+req.session.user[0].group_id+"' and p.delete_flag = '0' "+
                    "and p.drug_id = '"+req.body.product_id+"' ";
    var purchase = DB.get("Purchase");
    purchase.executeSql(purchaseSql,function(err,d){
      if(err){
        logger.error(req.session.user[0].realname + "修改药品，更新采进应收出错" + err);
      }
    });
    //更新预付招商
    var purchasePaySql = "update purchase_pay p set p.purchase_pay_should_price = '"+req.body.product_return_money+"',p.purchase_pay_should_money = ROUND(p.purchase_pay_number*"+req.body.product_return_money+",2) "+
                         "where p.purchase_pay_group_id = '"+req.session.user[0].group_id+"' and p.purchase_pay_delete_flag = '0' "+
                         "and p.purchase_pay_drug_id = '"+req.body.product_id+"' and (p.purchase_pay_should_money is null or p.purchase_pay_should_money = '0' or p.purchase_pay_should_money = '') "+
                         "and (p.purchase_pay_should_price is null or p.purchase_pay_should_price = '0' or p.purchase_pay_should_price = '')";
   var purchasePay = DB.get("PurchasePay");
   purchasePay.executeSql(purchasePaySql,function(err,d){
     if(err){
       logger.error(req.session.user[0].realname + "修改药品，更新预付招商出错" + err);
     }
   });
  }
});
//更新销售政策
function updateAllotPolicy(req){
  var getAllotPolicySql = "select * from allot_policy ap where ap.allot_drug_id = '"+req.body.product_id+"' and ap.allot_policy_money != '' and ap.allot_policy_money is not null";
  var allotPolicy = DB.get("AllotPolicy");
  allotPolicy.executeSql(getAllotPolicySql,function(err,d){//查询所有，政策相关的调货记录，用于更新调货政策
    if(err){
      logger.error(req.session.user[0].realname + "修改药品，查询调货政策出错" + err);
    }
    var copySql = "insert into allot_policy(allot_hospital_id,allot_drug_id,allot_policy_money,allot_policy_contact_id) values ";
    for(var i = 0 ; i < d.length ;i++){//查询已有医院政策
      var t =  util.getShouldPayMoney(d[i].allot_policy_formula,req.body.product_price,req.body.product_return_money,d[i].allot_policy_percent,0,d[i].allot_policy_money);
      t = Math.round(t*100)/100;
      copySql += "('"+d[i].allot_hospital_id+"','"+d[i].allot_drug_id+"','"+t+"','"+d[i].allot_policy_contact_id+"'),";
    }
    copySql = copySql.substring(0,copySql.length-1);
    copySql += " ON DUPLICATE KEY UPDATE allot_policy_money=VALUES(allot_policy_money)";
    allotPolicy.executeSql(copySql,function(err,d){
      if(err){
        logger.error(req.session.user[0].realname + "修改药品，修改调货政策出错" + err);
      }
      var message = req.session.user[0].realname+"修改药品，更新调货政策";
      util.saveLogs(req.session.user[0].group_id,"-","-",message);
    });
  });
}
//更新销售政策
function updateSalePolicy(req){
  var getSalePolicySql = "select * from sale_policy sp where sp.sale_drug_id = '"+req.body.product_id+"' and sp.sale_policy_money != '' and sp.sale_policy_money is not null";
  var getHospitalPolicy = "select * from hospital_policy_record hpr where hpr.hospital_policy_group_id = '"+req.session.user[0].group_id+"' and hpr.hospital_policy_delete_flag ='0' and hpr.hospital_policy_drug_id = '"+req.body.product_id+"'";
  var salePolicy = DB.get("SalePolicy");
  salePolicy.executeSql(getSalePolicySql,function(err,d){
    if(err){
      logger.error(req.session.user[0].realname + "修改药品，查询销售政策出错" + err);
    }
    salePolicy.executeSql(getHospitalPolicy,function(err,hospitalRecord){
      if(err){
        logger.error(req.session.user[0].realname + "修改药品，查询销售特殊政策政策出错" + err);
      }
      var copySql = "insert into sale_policy(sale_hospital_id,sale_drug_id,sale_policy_money,sale_policy_contact_id) values ";
      for(var i = 0 ; i < d.length ;i++){
        var price = req.body.product_price?req.body.product_price:0;
        var returnMoney = req.body.product_return_money?req.body.product_return_money:0;
        for(var j = 0 ; j < hospitalRecord.length;j++){
          if(d[i].sale_hospital_id == hospitalRecord[j].hospital_policy_hospital_id){
            price = !util.isEmptyAndZero(hospitalRecord[j].hospital_policy_price)?hospitalRecord[j].hospital_policy_price:price;
            returnMoney = !util.isEmptyAndZero(hospitalRecord[j].hospital_policy_return_money)?hospitalRecord[j].hospital_policy_return_money:returnMoney;
          }
        }
        var t =  util.getShouldPayMoney(d[i].sale_policy_formula,price,returnMoney,d[i].sale_policy_percent,0,d[i].sale_policy_money);
        t = Math.round(t*100)/100;
        copySql += "('"+d[i].sale_hospital_id+"','"+d[i].sale_drug_id+"','"+t+"','"+d[i].sale_policy_contact_id+"'),";
      }
      copySql = copySql.substring(0,copySql.length-1);
      copySql += " ON DUPLICATE KEY UPDATE sale_policy_money=VALUES(sale_policy_money),sale_policy_contact_id=VALUES(sale_policy_contact_id)";
      salePolicy.executeSql(copySql,function(err,d){
        if(err){
          logger.error(req.session.user[0].realname + "修改药品，修改销售政策出错" + err);
        }
        var message = req.session.user[0].realname+"修改药品，更新销售政策";
        util.saveLogs(req.session.user[0].group_id,"-","-",message);
      });
    });
  });
}

//删除菜单
router.post("/deleteDrugs",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",64,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var drugs = DB.get("Drugs");
  req.body.delete_flag = 1;
  drugs.update(req.body,'product_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "删除药品出错" + err);
    }
    var message = req.session.user[0].realname+"删除药品记录。id："+req.body.product_id
    util.saveLogs(req.session.user[0].group_id,"-","-",message);
    res.json({"code":"000000",message:null});
  });
});
//导出药品表
router.post("/exportDrugs",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",122,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var findParam = JSON.stringify(req.body);
  req.body.data = JSON.parse(findParam);
  var drugs = DB.get("Drugs");
  var sql = getDrugsSql(req);
  sql += " order by sbus.product_create_time asc ";
  drugs.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "导出药品出错" + err);
    }
    var conf ={};
    conf.stylesXmlFile = "./utils/styles.xml";
    conf.name = "mysheet";
    conf.cols = [{caption:'产品编码',type:'string'
    },{caption:'产品名称',type:'string'
    },{caption:'产品规格',type:'string'
    },{caption:'生产厂家',type:'string'
    },{caption:'单位',type:'string'
    },{caption:'包装',type:'number'
    },{caption:'中标价',type:'number'
    },{caption:'商业',type:'string'
    },{caption:'采购员',type:'string'
    },{caption:'品种类型',type:'string'
    },{caption:'积分',type:'number'
    },{caption:'联系人',type:'string'
    },{caption:'医保类型',type:'string'
    },{caption:'采购方式',type:'string'
    },{caption:'是否基药',type:'string'
    },{
      caption:'标签',type:'string',
      beforeCellWrite:function(row, cellData){
        if(cellData){
          return cellData.substring(0,cellData.length-1);
        }else{
          return "";
        }
      }
    },{caption:'核算成本',type:'string'
    },{caption:'毛利率',type:'string'
    }];
    var header = ['product_code', 'product_common_name', 'product_specifications',
                  'product_makesmakers','product_unit','product_packing','product_price','business_name','buyer',
                  'product_type','product_return_money','contacts_name','product_medical_type','product_purchase_mode',
                  'product_basic_medicine','tag_names','accounting_cost','gross_interest_rate'];
    conf.rows = util.formatExcel(header,result);
    var result = nodeExcel.execute(conf);
    var message = req.session.user[0].realname+"导出药品记录。"+conf.rows.length+"条";
    util.saveLogs(req.session.user[0].group_id,"-",findParam,message);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats');
    res.setHeader("Content-Disposition", "attachment; filename=" + "Report.xlsx");
    res.end(result, 'binary');
  });
});
//获取药品列表
router.post("/getDrugs",function(req,res){
  var noDate = new Date();
  if(req.session.user[0].authority_code.indexOf(",65,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var drugs = DB.get("Drugs");
  var sql = getDrugsSql(req);
  drugs.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询药品列表，查询总数出错" + err);
    }
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql += " order by sbus.product_create_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
    drugs.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "查询药品列表出错" + err);
      }
      req.body.page.data = result;
      logger.error(req.session.user[0].realname + "drugs-getDrugs运行时长" + (noDate.getTime()-new Date().getTime()));
      res.json({"code":"000000",message:req.body.page});
    });
  });
});

function getDrugsSql(req){
  var salesSql = "select * from drugs ds left join (select distinct s.product_code as readonly from sales s where s.delete_flag = '0' and s.group_id = '"+req.session.user[0].group_id+"') sr "+
                 "on ds.product_code = sr.readonly where ds.delete_flag = '0' and ds.group_id = '"+req.session.user[0].group_id+"'";
  var sql = "select d.*,c.contacts_name from ("+salesSql+") d left join contacts c on d.contacts_id = c.contacts_id where 1=1";
  if(!util.isEmpty(req.body.data.productCommonName)){
    sql += " and (d.product_common_name like '%"+req.body.data.productCommonName+"%' or d.product_name_pinyin like '%"+req.body.data.productCommonName+"%')";
  }
  if(!util.isEmpty(req.body.data.product_makesmakers)){
    sql += " and d.product_makesmakers like '%"+req.body.data.product_makesmakers+"%'";
  }
  if(!util.isEmpty(req.body.data.contactId)){
    sql += " and d.contacts_id = '"+req.body.data.contactId+"'";
  }
  if(!util.isEmpty(req.body.data.product_distribution_flag)){
    sql += " and d.product_distribution_flag = '"+req.body.data.product_distribution_flag+"'";
  }
  if(!util.isEmpty(req.body.data.product_medical_type)){
    sql += " and d.product_medical_type = '"+req.body.data.product_medical_type+"'"
  }
  if(!util.isEmpty(req.body.data.product_code)){
    sql += " and d.product_code like '%"+req.body.data.product_code+"%'"
  }
  if(!util.isEmpty(req.body.data.business)){
    sql += " and d.product_business = '"+req.body.data.business+"'"
  }
  if(!util.isEmpty(req.body.data.product_specifications)){
    sql += " and d.product_specifications = '"+req.body.data.product_specifications+"'"
  }
  if(!util.isEmpty(req.body.data.rate_gap) && req.body.data.rate_gap!=0){
    sql += " and (d.product_price-d.accounting_cost)*100/d.product_price  "+req.body.data.rate_formula+" "+req.body.data.rate_gap+" "
  }
  if(!util.isEmpty(req.body.data.product_type)){
    var type = req.body.data.product_type;
    if(typeof type == 'object'){
      var t = type.join(",").replace(/,/g,"','");
      sql += " and d.product_type in ('"+t+"')"
    }else{
      sql += " and d.product_type in ('"+type+"')"
    }
  }
  //连接查询标签
  var tagSql = "select td.drug_id,concat(GROUP_CONCAT(td.tag_id),',') tag_ids,concat(GROUP_CONCAT(tagd.tag_name),',') tag_names from tag_drug td left join tag tagd on td.tag_id = tagd.tag_id "+
               "where td.tag_drug_deleta_flag = '0' and td.tag_drug_group_id = '"+req.session.user[0].group_id+"' "+
               "group by td.drug_id ";
  sql = "select sbust.*,tag.tag_ids,tag.tag_names from ("+sql+") sbust left join ("+tagSql+") tag on sbust.product_id = tag.drug_id ";
  if(req.body.data.tag && req.body.data.tag != 'undefined'){
     sql += "where tag.tag_ids like '%"+req.body.data.tag+",%'";
  }
  sql = "select sbus.*,bus.business_name from ("+sql+") sbus left join business bus on sbus.product_business = bus.business_id ";
  return sql;
}
//获取库存统计
router.post("/getStockNum",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",65,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var drugs = DB.get("Drugs");
  var stockNumSql = "select sum(p.purchase_money*bs.batch_stock_number/p.purchase_number) pm,sum(bs.batch_stock_number) bn,bs.batch_stock_drug_id from batch_stock bs left join purchase p on p.purchase_id = bs.batch_stock_purchase_id "+
                    "where bs.tag_type_delete_flag = '0' and bs.tag_type_group_id = '"+req.session.user[0].group_id+"' and "+
                    "p.group_id = '"+req.session.user[0].group_id+"' and p.delete_flag = '0' "+
                    "group by bs.batch_stock_drug_id ";
  var sql = "select sum(st.bn*d.product_mack_price) mpn,sum(st.bn) sn,sum(st.pm) bpm from drugs d left join ("+stockNumSql+") st on d.product_id = st.batch_stock_drug_id "+
            " where d.delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"'";
  if(!util.isEmpty(req.body.data.productCommonName)){
    sql += " and (d.product_common_name like '%"+req.body.data.productCommonName+"%' or d.product_name_pinyin like '%"+req.body.data.productCommonName+"%')";
  }
  if(!util.isEmpty(req.body.data.product_code)){
    sql += " and d.product_code = '"+req.body.data.product_code+"'"
  }
  if(!util.isEmpty(req.body.data.product_type)){
    var type = req.body.data.product_type;
    var t = "";
    for(var i = 0 ; i < type.length ; i++){
      t+="'"+type[i]+"',"
    }
    t = t.substring(0,t.length-1);
    sql += " and d.product_type in ("+t+")"
  }
  drugs.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "统计库存总量出量" + err);
    }
    res.json({"code":"000000",message:result[0]});
  });
});
// //获取药品列表
// router.get("/getDrugs",function(req,res){
//   var drugs = DB.get("Drugs");
//   var sql = "select * from drugs";
//   drugs.executeSql(sql,function(err,result){
    // for(var i = 0 ; i < result.length ;i++){
    //   var temp = "";
    //   pinyin(result[i].product_common_name, {
    //     style: "normal"
    //   }).forEach(function(i){
    //     temp+=i[0].substring(0,1);
    //   });
    //   var updateSql = "update drugs set product_name_pinyin = '"+temp+"' where product_id = "+result[i].product_id+"";
    //   drugs.executeSql(updateSql,function(err,result){});
    // }
//
//     res.json({"code":"000000",message:"success"});
//   });
// });
//获取生产企业，分组查询
router.post("/getProductMakesmakers",function(req,res){
  var drugs = DB.get("Drugs");
  var sql = "select d.product_makesmakers,d.product_supplier from drugs d where d.group_id = '"+req.session.user[0].group_id+"' group by d.product_makesmakers,d.product_supplier";
  drugs.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "药品管理，分组查询生产企业出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
//获取商业，分组查询
router.post("/getProductBusiness",function(req,res){
  var drugs = DB.get("Drugs");
  var sql = "select d.product_business from drugs d where d.delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"' group by d.product_business";
  drugs.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "药品管理，分组查询商业出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
module.exports = router;
