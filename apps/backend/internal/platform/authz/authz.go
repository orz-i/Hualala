package authz

type Authorizer struct{}

func NewAuthorizer() Authorizer {
	return Authorizer{}
}
