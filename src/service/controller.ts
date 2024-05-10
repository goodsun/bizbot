import { CONST } from "../common/const.js";
import sqsService from "../service/sqs.js";
import ethreiumService from "../service/etherium.js";
import discordService from "../service/discord.js";
import notionService from "../service/notion.js";
import memberModel from "../model/members.js";
import { Message } from "../types/message.js";

const discordList = async () => {
  const result = await discordService.getDisplayData();
  console.log("Discord test:" + result);
  return result;
};

const dynamoList = async () => {
  console.log("DYNAMO SETTING : " + CONST.DYNAMO_MEMBER_TABLENAME);
  const result = await memberModel.getDisplayData();
  console.log("Dynamo test:" + result);
  return result;
};

const notionList = async () => {
  const result = await notionService.getDisplayData();
  console.log("Notion test:" + result);
  return result;
};

const sqsSend = async (message: Message) => {
  const result = await sqsService.sendMessage(JSON.stringify(message));
  console.log("SendMes" + result);
  return result;
};
const notionUpdate = async () => {
  const discordList = await discordService.getMemberList();
  const notionList = await notionService.getMemberList();
  await notionService.memberListUpdate(discordList, notionList);
};

const dynamoUpdate = async () => {
  const discordList = await discordService.getMemberList();
  const dynamoList = await memberModel.getAllList();
  await memberModel.memberListUpdate(discordList, dynamoList);
};

const getTokenInfo = async (req) => {
  const result = await ethreiumService.getTokenInfo(req);
  return result;
};

const controller = {
  discordList,
  dynamoList,
  notionList,
  dynamoUpdate,
  notionUpdate,
  sqsSend,
  getTokenInfo,
};

export default controller;