import { CRUD } from "../types/crud.js";
import { CONST } from "../common/const.js";
import utils from "../common/util.js";
import dynamoService from "../service/dynamo.js";
const TableName = CONST.DYNAMO_TABLE_PREFIX + "_member";

const memberSetSecret = async (id: String, tmpEoa: String, secret: String) => {
  const member = await getMember(id);
  let params = CRUD.update;
  params.TableName = TableName;
  params.Key.DiscordId.N = String(member.DiscordId);
  params.UpdateExpression =
    "SET #Secret = :secret, #Expired = :expired, #TmpEoa = :tmpEoa, #Updated = :updated";
  params.ExpressionAttributeValues = {
    ":secret": { S: secret } as object,
    ":tmpEoa": { S: tmpEoa } as object,
    ":updated": { S: new Date(new Date().getTime()) } as object,
    ":expired": {
      S: new Date(new Date().getTime() + 10 * 60 * 1000),
    } as object,
  };
  params.ExpressionAttributeNames = {
    "#Secret": "Secret",
    "#Expired": "Expired",
    "#TmpEoa": "TmpEoa",
    "#Updated": "Updated",
  } as object;
  await dynamoService.updateItem(params);

  const detail =
    "dynamo あいことば登録 " +
    id +
    // member.DiscordId.N +
    " name:" +
    //member.Name.S +
    " あいことば：" +
    secret;
  return detail;
};

const memberSetEoa = async (id: String, eoa: String, secret: String) => {
  try {
    const member = await getMember(id);
    const expired = utils.str2unixtime(member.Expired);
    const now = utils.str2unixtime(new Date().getTime());
    let result = "取得後結果確認";
    if (
      utils.isAddressesEqual(String(member.TmpEoa), String(eoa)) &&
      String(member.Secret) == secret &&
      now < expired
    ) {
      let params = CRUD.update;
      params.TableName = TableName;
      params.Key.DiscordId.N = String(member.DiscordId);
      params.UpdateExpression = "SET Eoa = :newVal, Updated = :updated";
      params.ExpressionAttributeValues = {
        ":newVal": { S: eoa } as object,
        ":updated": { S: new Date(new Date().getTime()) } as object,
      };
      await dynamoService.updateItem(params);
      result += " 承認OK";
    } else {
      result += " 承認NG";
    }

    return result;
  } catch (error) {
    return "エラーが発生しました。";
  }
};

const getMemberList = async () => {
  let params = CRUD.query;
  params.TableName = TableName;
  const result = await dynamoService.query(params);
  return result;
};

const getAllList = async () => {
  return await dynamoService.getAllItems(TableName);
};

const getMember = async (id) => {
  let params = CRUD.read;
  params.TableName = TableName;
  params.Key.DiscordId.N = id;
  return await dynamoService.getItem(params);
};

const getMemberByEoa = async (eoa) => {
  let params = CRUD.query;
  params.TableName = TableName;
  params.KeyConditionExpression = "#PartitionName = :PartitionName";
  params.FilterExpression = "#DeleteFlag = :DeleteFlag and #Eoa = :Eoa";
  params.ExpressionAttributeNames = {
    "#PartitionName": "PartitionName",
    "#DeleteFlag": "DeleteFlag",
    "#Eoa": "Eoa",
  } as object;
  params.ExpressionAttributeValues = {
    ":PartitionName": { S: "Users" },
    ":DeleteFlag": { BOOL: false },
    ":Eoa": { S: eoa },
  } as object;
  const result = await dynamoService.query(params);
  if (result.Count == 1) {
    let user = result.Items[0];
    delete user.TmpEoa;
    delete user.Secret;
    user.DiscordId = String(user.DiscordId);
    console.dir(user);
    return user;
  } else if (result.Count == 0) {
    return { message: "member not found" };
  } else {
    return { message: "many member" };
  }
};

const getDisplayMember = async (req) => {
  const member = await getMember(req.params.id);
  let result = "<div>";
  if (member != undefined) {
    result = result + "<img src='" + member.Icon + "' />";
    result = result + "<br />id : " + req.params.id;
    result = result + "<br /> name : " + member.Name;
    console.log(member.Roles.Count);
    member.Roles.forEach((role) => {
      console.log(role);
    });
    if (member.Roles.size > 0) {
      result = result + "<br /> roles : ";
      member.Roles.forEach((role) => {
        result = result + "<span>" + role + "</span>  ";
      });
    }
    result = result + "<br /> join : " + member.Join;
    result = result + "<br /> exit : " + member.DeleteFlag;
    result = result + "<br /> update : " + member.Updated;
    if (member.Eoa) {
      result = result + "<br /> eoa : " + member.Eoa;
    }
  }
  result = result + "</div>";
  return result;
};

const getDisplayData = async () => {
  const list = await getMemberList();
  if (list == undefined) {
    let params = CRUD.create;
    params.TableName = TableName;
    dynamoService.createTable(params);
    return "TABLE CREATE : " + TableName;
  } else {
    let result = "<div>";
    for (let key in list.Items) {
      const data = list.Items[key];
      result =
        result +
        key +
        " | " +
        'Id: <b><a href="/dynamo/member/' +
        data.DiscordId +
        '">' +
        data.DiscordId +
        "</a></b>" +
        " name: <b>" +
        data.Name +
        "</b><br />";
    }
    result = result + "</div>";
    return result;
  }
};

const memberCreate = async (member) => {
  console.log("メンバー情報新規登録");
  let params = CRUD.write;
  params.TableName = TableName;
  params.Item.DiscordId.N = String(member.DiscordId);
  params.Item.Name.S = member.Name;
  params.Item.Username.S = member.Username;
  params.Item.Icon.S = member.Icon;
  params.Item.Join.S = member.Join;
  if (member.Roles.length == 0) {
    params.Item.Roles.SS = [""];
  } else {
    params.Item.Roles.SS = member.Roles;
  }
  await dynamoService.putItem(params);
};

const memberUpdate = async (member) => {
  const exist = await getMember(member.DiscordId);
  console.dir(exist);
  if (!exist) {
    await memberCreate(member);
    return;
  }
  console.log("メンバー情報更新");
  let params = CRUD.update;
  params.TableName = TableName;
  params.Key.DiscordId.N = String(member.DiscordId);
  params.UpdateExpression =
    "SET #Name = :Name, #Username = :Username, #Icon = :Icon, #Roles= :roles, #Updated = :updated";
  params.ExpressionAttributeNames = {
    "#Name": "Name",
    "#Username": "Username",
    "#Icon": "Icon",
    "#Roles": "Roles",
    "#Updated": "Updated",
  } as object;
  params.ExpressionAttributeValues = {
    ":Name": { S: member.Name } as object,
    ":Username": { S: member.Username } as object,
    ":Icon": { S: member.Icon } as object,
    ":roles": { SS: member.Roles } as object,
    ":updated": { S: new Date(new Date().getTime()) } as object,
  };
  console.dir(params);
  await dynamoService.updateItem(params);
};

const memberDelete = async (id) => {
  console.log("メンバー削除" + id);
  let params = CRUD.delete;
  params.TableName = TableName;
  params.Key.DiscordId.N = id;
  await dynamoService.deleteItem(params);
};

const memberSoftDelete = async (member) => {
  let params = CRUD.update;
  params.TableName = TableName;
  params.Key.DiscordId.N = member.DiscordId;
  params.UpdateExpression = "SET DeleteFlag = :newVal, Updated = :updated";
  params.ExpressionAttributeValues = {
    ":newVal": { BOOL: true } as object,
    ":updated": { S: new Date(new Date().getTime()) } as object,
  };
  await dynamoService.updateItem(params);
};

const memberListUpdate = async (discordList, dynamoList) => {
  let addCnt = 0;
  let updateCnt = 0;
  let delCnt = 0;
  for (let key in discordList) {
    const member = discordList[key];
    const filteredItems = dynamoList.filter(
      (item) => parseInt(item.DiscordId.N) === member.id
    );
    if (filteredItems.length == 0) {
      addCnt++;
      await memberModel.memberCreate(member);
    } else {
      const dcRoles = JSON.stringify(
        member.roles.filter((role) => role !== "").sort()
      );
      const dyRoles = JSON.stringify(
        filteredItems[0].Roles.SS.filter((role) => role !== "").sort()
      );
      if (
        member.name !== filteredItems[0].Name.S ||
        member.icon !== filteredItems[0].Icon.S ||
        dcRoles !== dyRoles
      ) {
        updateCnt++;
        await memberModel.memberUpdate(member);
      }
    }
  }

  for (let key in dynamoList) {
    const member = dynamoList[key];
    if (member) {
      const filteredItems = discordList.filter(
        (item) => item.id === parseInt(member.DiscordId.N)
      );
      if (filteredItems.length == 0) {
        delCnt++;
        if (CONST.DYNAMO_SOFT_DELETE == "true") {
          await memberModel.memberSoftDelete(member);
        } else {
          await memberModel.memberDelete(member);
        }
      }
    }
  }
  console.log("dis:" + discordList.length + " dyn:" + dynamoList.length);
  console.log("add:" + addCnt + " update:" + updateCnt + " del:" + delCnt);
};

const discordId2eoa = async (discordId) => {
  const member = await getMember(discordId);
  if (member) {
    return member.Eoa;
  } else {
    return "0x";
  }
};

const memberModel = {
  getAllList,
  getMemberList,
  getMember,
  getMemberByEoa,
  memberCreate,
  memberUpdate,
  memberDelete,
  memberSoftDelete,
  memberListUpdate,
  getDisplayData,
  getDisplayMember,
  memberSetSecret,
  memberSetEoa,
  discordId2eoa,
};
export default memberModel;
