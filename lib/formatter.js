export const formatMessage = (role, messageContent) => {
    return `${role}: ${messageContent}\n`;
};

export const formatMessageArr = (itemArr) => {
    const formattedArr = [];
    for (const item of itemArr) {
        formattedArr.push(item.pageContent);
    };
    return formattedArr;
};
