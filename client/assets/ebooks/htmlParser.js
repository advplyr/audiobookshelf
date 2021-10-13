/*
This is borrowed from koodo-reader https://github.com/troyeguo/koodo-reader/tree/master/src
*/

export const isTitle = (
  line,
  isContainDI = false,
  isContainChapter = false,
  isContainCHAPTER = false
) => {
  return (
    line.length < 30 &&
    line.indexOf("[") === -1 &&
    line.indexOf("(") === -1 &&
    (line.startsWith("CHAPTER") ||
      line.startsWith("Chapter") ||
      line.startsWith("序章") ||
      line.startsWith("前言") ||
      line.startsWith("声明") ||
      line.startsWith("聲明") ||
      line.startsWith("写在前面的话") ||
      line.startsWith("后记") ||
      line.startsWith("楔子") ||
      line.startsWith("后序") ||
      line.startsWith("寫在前面的話") ||
      line.startsWith("後記") ||
      line.startsWith("後序") ||
      /(?=[MDCLXVI])M*(C[MD]|D?C{0,3})(X[CL]|L?X{0,3})(I[XV]|V?I{0,3})$/.test(
        line
      ) ||
      (line.startsWith("第") && startWithDI(line)) ||
      (line.startsWith("卷") && startWithJUAN(line)) ||
      startWithRomanNum(line) ||
      (!isContainDI &&
        !isContainChapter &&
        !isContainCHAPTER &&
        line.indexOf("第") > -1 &&
        (line[line.indexOf("第") - 1] === " " ||
          line[line.indexOf("第") - 1] === "　" ||
          line[line.indexOf("第") - 1] === "、" ||
          line[line.indexOf("第") - 1] === "：" ||
          line[line.indexOf("第") - 1] === ":") &&
        startWithDI(line.substr(line.indexOf("第")))) ||
      (!isContainDI &&
        !isContainChapter &&
        !isContainCHAPTER &&
        line.indexOf(" ") &&
        startWithNumAndSpace(line)) ||
      (!isContainDI &&
        !isContainChapter &&
        !isContainCHAPTER &&
        line.indexOf("　") &&
        startWithNumAndSpace(line)) ||
      (!isContainDI &&
        !isContainChapter &&
        !isContainCHAPTER &&
        line.indexOf("、") &&
        startWithNumAndPause(line)) ||
      (!isContainDI &&
        !isContainChapter &&
        !isContainCHAPTER &&
        line.indexOf("：") &&
        startWithNumAndColon(line)) ||
      (!isContainDI &&
        !isContainChapter &&
        !isContainCHAPTER &&
        line.indexOf(":") &&
        startWithNumAndColon(line)))
  );
};
const startWithDI = (line) => {
  let keywords = [
    "章",
    "节",
    "回",
    "節",
    "卷",
    "部",
    "輯",
    "辑",
    "話",
    "集",
    "话",
    "篇",
  ];
  let flag = false;
  for (let i = 0; i < keywords.length; i++) {
    if (
      (line.indexOf(keywords[i]) > -1 &&
        (line[line.indexOf(keywords[i]) + 1] === " " ||
          line[line.indexOf(keywords[i]) + 1] === "　" ||
          line[line.indexOf(keywords[i]) + 1] === "、" ||
          line[line.indexOf(keywords[i]) + 1] === "：" ||
          line[line.indexOf(keywords[i]) + 1] === ":")) ||
      !line[line.indexOf(keywords[i]) + 1]
    ) {
      if (
        /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c]+$/.test(
          line.substring(1, line.indexOf(keywords[i])).trim()
        ) ||
        /^\d+$/.test(line.substring(1, line.indexOf(keywords[i])).trim())
      ) {
        flag = true;
      }
      if (flag) break;
    }
  }
  return flag;
};
const startWithJUAN = (line) => {
  if (
    /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c]+$/.test(
      line.substring(1, line.indexOf(" "))
    ) ||
    /^\d+$/.test(line.substring(1, line.indexOf(" ")))
  )
    return true;
  if (
    /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c]+$/.test(
      line.substring(1, line.indexOf("　"))
    ) ||
    /^\d+$/.test(line.substring(1, line.indexOf("　")))
  )
    return true;
  if (
    /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c]+$/.test(
      line.substring(1)
    ) ||
    /^\d+$/.test(line.substring(1))
  )
    return true;
  return false;
};
const startWithRomanNum = (line) => {
  if (
    /(?=[MDCLXVI])M*(C[MD]|D?C{0,3})(X[CL]|L?X{0,3})(I[XV]|V?I{0,3})$/.test(
      line.substring(0, line.indexOf(" "))
    )
  )
    return true;
  if (
    /(?=[MDCLXVI])M*(C[MD]|D?C{0,3})(X[CL]|L?X{0,3})(I[XV]|V?I{0,3})$/.test(
      line.substring(0, line.indexOf("."))
    )
  )
    return true;
  if (
    /(?=[MDCLXVI])M*(C[MD]|D?C{0,3})(X[CL]|L?X{0,3})(I[XV]|V?I{0,3})$/.test(
      line.trim()
    )
  )
    return true;
  return false;
};
const startWithNumAndSpace = (line) => {
  if (
    /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c]+$/.test(
      line.substring(0, line.indexOf(" "))
    )
  )
    return true;
  if (
    /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c]+$/.test(
      line.substring(0, line.indexOf("　"))
    )
  )
    return true;

  if (/^\d+$/.test(line.substring(0, line.indexOf(" ")))) return true;
  if (/^\d+$/.test(line.substring(0, line.indexOf("　")))) return true;
  return false;
};
const startWithNumAndColon = (line) => {
  if (
    /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c]+$/.test(
      line.substring(0, line.indexOf(":"))
    )
  )
    return true;
  if (
    /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c]+$/.test(
      line.substring(0, line.indexOf("："))
    )
  )
    return true;

  if (/^\d+$/.test(line.substring(0, line.indexOf(":")))) return true;
  if (/^\d+$/.test(line.substring(0, line.indexOf("：")))) return true;
  return false;
};
const startWithNumAndPause = (line) => {
  if (
    /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c]+$/.test(
      line.substring(0, line.indexOf("、"))
    )
  )
    return true;

  if (/^\d+$/.test(line.substring(0, line.indexOf("、")))) return true;
  return false;
};


class HtmlParser {
  bookDoc;
  contentList;
  contentTitleList;
  constructor(bookDoc) {
    this.bookDoc = bookDoc;
    this.contentList = [];
    this.contentTitleList = [];
    this.getContent(bookDoc);
  }
  getContent(bookDoc) {
    this.contentList = Array.from(
      bookDoc.querySelectorAll("h1,h2,h3,h4,h5,b,font")
    ).filter((item, index) => {
      return isTitle(item.innerText.trim());
    });

    for (let i = 0; i < this.contentList.length; i++) {
      let random = Math.floor(Math.random() * 900000) + 100000;
      this.contentTitleList.push({
        label: this.contentList[i].innerText,
        id: "title" + random,
        href: "#title" + random,
        subitems: [],
      });
    }
    for (let i = 0; i < this.contentList.length; i++) {
      this.contentList[i].id = this.contentTitleList[i].id;
    }
  }
  getAnchoredDoc() {
    return this.bookDoc;
  }
  getContentList() {
    return this.contentTitleList.filter((item, index) => {
      if (index > 0) {
        return item.label !== this.contentTitleList[index - 1].label;
      } else {
        return true;
      }
    });
  }
}

export default HtmlParser;
