export function GoogleLogin() {
  try {
    window.location.href = `http://localhost:8080/oauth2/authorization/google`;
    console.log("click");
  } catch (error) {
    console.log("구글 로그인 에러", error);
    throw error;
  }
}

export function GithubLogin() {
  try {
    window.location.href = `http://localhost:8080/oauth2/authorization/github`;
    console.log("click");
  } catch (error) {
    console.log("깃허브 로그인 에러", error);
    throw error;
  }
}
