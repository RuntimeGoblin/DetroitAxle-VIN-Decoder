package helpers

import "github.com/gin-gonic/gin"

type Response struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
	Data    any    `json:"data,omitempty"`
	Error   string `json:"error,omitempty"`
}

func OK(c *gin.Context, data any) {
	c.JSON(200, Response{Success: true, Data: data})
}

func Fail(c *gin.Context, status int, msg string) {
	c.JSON(status, Response{Success: false, Error: msg})
}
