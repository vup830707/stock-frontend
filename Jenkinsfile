pipeline {
  agent none

  stages {
    stage('CI - Build') {
      agent {
        docker {
          image 'node:20-alpine'
          args '-u root:root'
          reuseNode true
        }
      }
      steps {
        sh 'node -v'
        sh 'npm -v'
        sh 'npm ci'
        sh 'npm run build'
      }
    }

    stage('CD - Deploy Frontend') {
      agent {
        docker {
          image 'docker:27-cli'
          // ✅ 用 root 執行，才能 apk add
          args '-u 0:0 -v /var/run/docker.sock:/var/run/docker.sock -v $WORKSPACE:/work -w /work'
          reuseNode true
        }
      }
      steps {
        sh '''
        docker version
        apk add --no-cache docker-cli-compose
        docker compose version

        # ✅ 如果舊容器存在就刪掉，避免 container_name 衝突
        docker rm -f stock-frontend 2>/dev/null || true

        docker compose up -d --build --force-recreate frontend
        '''
      }
    }
  }
}
