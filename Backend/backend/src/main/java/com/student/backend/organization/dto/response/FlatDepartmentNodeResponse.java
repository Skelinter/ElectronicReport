package com.student.backend.organization.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FlatDepartmentNodeResponse {
    private UUID departmentId;
    private UUID parentDepartmentId;   // может быть null для корневых узлов
    private String name;
    private String shortName;
    private Integer depth;             // глубина иерархии (0 - корневой, 1 - первый уровень и т.д.)
    private List<UUID> path;           // массив ID всех родителей от корня до текущего узла
}